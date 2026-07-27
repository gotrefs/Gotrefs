import { formatCardValidThrough } from "@/lib/ref-id-card-validity";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { createServiceClient } from "@/lib/supabase/service";

export type PublicRefIdCard = {
  gotrefsId: string;
  primarySport: string | null;
  additionalSports: string[];
  certificationLevel: string | null;
  additionalCertificationLevels: string[];
  certifiedBy: string | null;
  baseCity: string | null;
  workRegions: string[];
  avatarUrl: string | null;
  verificationStatus: string | null;
  validThrough: string | null;
  profileComplete: boolean;
};

type ProfileRow = {
  member_id: string;
  gotrefs_id?: string | null;
  primary_sport: string | null;
  additional_sports: unknown;
  certification_level: string | null;
  additional_certification_levels?: unknown;
};

const PROFILE_SELECT_WITH_ID =
  "member_id, gotrefs_id, primary_sport, additional_sports, certification_level, additional_certification_levels";
const PROFILE_SELECT_BASE =
  "member_id, primary_sport, additional_sports, certification_level, additional_certification_levels";
const PROFILE_SELECT_WITH_ID_LEGACY =
  "member_id, gotrefs_id, primary_sport, additional_sports, certification_level";
const PROFILE_SELECT_BASE_LEGACY = "member_id, primary_sport, additional_sports, certification_level";

export function normalizeGotrefsId(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

function metaGotrefsId(meta: Record<string, unknown> | null | undefined): string {
  const value = meta?.gotrefs_id;
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42703" || /does not exist/i.test(error?.message ?? "");
}

async function findAuthUserByGotrefsId(
  admin: ReturnType<typeof createServiceClient>,
  gotrefsId: string
) {
  let page = 1;
  while (page <= 5) {
    const { data: listed, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = listed?.users ?? [];
    const match = users.find((user) => {
      const metaId = metaGotrefsId(user.user_metadata as Record<string, unknown>);
      return metaId && metaId.toUpperCase() === gotrefsId;
    });
    if (match) return match;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

async function loadProfileByMemberId(
  admin: ReturnType<typeof createServiceClient>,
  memberId: string
): Promise<ProfileRow | null> {
  const withId = await admin
    .from("ref_profiles")
    .select(PROFILE_SELECT_WITH_ID)
    .eq("member_id", memberId)
    .maybeSingle();

  if (!isMissingColumnError(withId.error)) {
    return (withId.data as ProfileRow | null) ?? null;
  }

  const legacyWithId = await admin
    .from("ref_profiles")
    .select(PROFILE_SELECT_WITH_ID_LEGACY)
    .eq("member_id", memberId)
    .maybeSingle();

  if (!isMissingColumnError(legacyWithId.error)) {
    return (legacyWithId.data as ProfileRow | null) ?? null;
  }

  const base = await admin
    .from("ref_profiles")
    .select(PROFILE_SELECT_BASE_LEGACY)
    .eq("member_id", memberId)
    .maybeSingle();

  return (base.data as ProfileRow | null) ?? null;
}

/** Load public ID card fields by GotRefs ID (no legal name/email/phone). */
export async function loadPublicRefIdCard(rawId: string): Promise<PublicRefIdCard | null> {
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) return null;

  const admin = createServiceClient();

  let profile: ProfileRow | null = null;

  const exact = await admin
    .from("ref_profiles")
    .select(PROFILE_SELECT_WITH_ID)
    .eq("gotrefs_id", gotrefsId)
    .maybeSingle();

  if (!isMissingColumnError(exact.error)) {
    profile = (exact.data as ProfileRow | null) ?? null;
    if (!profile) {
      const { data: rows } = await admin
        .from("ref_profiles")
        .select(PROFILE_SELECT_WITH_ID)
        .ilike("gotrefs_id", gotrefsId)
        .limit(1);
      profile = (rows?.[0] as ProfileRow | undefined) ?? null;
    }
  } else {
    const legacyExact = await admin
      .from("ref_profiles")
      .select(PROFILE_SELECT_WITH_ID_LEGACY)
      .eq("gotrefs_id", gotrefsId)
      .maybeSingle();
    profile = (legacyExact.data as ProfileRow | null) ?? null;
  }

  // Fallback: auth metadata may have gotrefs_id before ref_profiles was synced / migrated.
  if (!profile?.member_id) {
    const match = await findAuthUserByGotrefsId(admin, gotrefsId);
    if (match) {
      const rp = await loadProfileByMemberId(admin, match.id);
      const meta = (match.user_metadata ?? {}) as Record<string, unknown>;
      profile = rp ?? {
        member_id: match.id,
        gotrefs_id: gotrefsId,
        primary_sport: typeof meta.primary_sport === "string" ? meta.primary_sport : null,
        additional_sports: Array.isArray(meta.additional_sports) ? meta.additional_sports : [],
        certification_level:
          typeof meta.certification_level === "string" ? meta.certification_level : null,
      };

      // Best-effort sync for next scan (no-op if column missing).
      void admin
        .from("ref_profiles")
        .upsert(
          {
            member_id: match.id,
            gotrefs_id: gotrefsId,
            primary_sport: profile.primary_sport,
            additional_sports: profile.additional_sports,
            certification_level: profile.certification_level,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        )
        .then(({ error }) => {
          if (error && !isMissingColumnError(error)) {
            console.warn("[public-ref-id-card] gotrefs_id sync failed", error.message);
          }
        });
    }
  }

  if (!profile?.member_id) return null;

  if (!profile.gotrefs_id || String(profile.gotrefs_id).toUpperCase() !== gotrefsId) {
    void admin
      .from("ref_profiles")
      .update({ gotrefs_id: gotrefsId })
      .eq("member_id", profile.member_id)
      .then(({ error }) => {
        if (error && !isMissingColumnError(error)) {
          console.warn("[public-ref-id-card] gotrefs_id update failed", error.message);
        }
      });
  }

  const memberWithPhoto = await admin
    .from("members")
    .select("profile_picture_url, role")
    .eq("id", profile.member_id)
    .maybeSingle();

  let member = memberWithPhoto.data as { profile_picture_url?: string | null; role?: string } | null;
  if (isMissingColumnError(memberWithPhoto.error)) {
    const roleOnly = await admin.from("members").select("role").eq("id", profile.member_id).maybeSingle();
    member = roleOnly.data;
  }

  const [{ data: submission }, authResult] = await Promise.all([
    admin
      .from("ref_verification_submissions")
      .select("status, reviewed_at")
      .eq("ref_member_id", profile.member_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(profile.member_id),
  ]);

  if (member?.role && member.role !== "ref") return null;

  const meta = (authResult.data.user?.user_metadata ?? {}) as Record<string, unknown>;
  const metaGotrefs = metaGotrefsId(meta);
  const displayId = (profile.gotrefs_id || metaGotrefs || gotrefsId).trim();

  const photoSource =
    member?.profile_picture_url ||
    (typeof meta.profile_picture_url === "string" ? meta.profile_picture_url : null) ||
    (typeof meta.avatar_url === "string" ? meta.avatar_url : null);

  const avatarUrl = await resolveProfilePhotoUrl(admin, photoSource, 60 * 60 * 12);

  const additionalSports = Array.isArray(profile.additional_sports)
    ? profile.additional_sports.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    : Array.isArray(meta.additional_sports)
      ? meta.additional_sports.filter((s: unknown): s is string => typeof s === "string")
      : [];

  const additionalCertificationLevels = Array.isArray(profile.additional_certification_levels)
    ? profile.additional_certification_levels.filter(
        (s): s is string => typeof s === "string" && Boolean(s.trim())
      )
    : Array.isArray(meta.additional_certification_levels)
      ? meta.additional_certification_levels.filter((s: unknown): s is string => typeof s === "string")
      : [];

  const workRegions = Array.isArray(meta.work_regions)
    ? meta.work_regions.filter((s: unknown): s is string => typeof s === "string")
    : [];

  const certifiedByRaw =
    (typeof meta.certified_by === "string" && meta.certified_by.trim()) ||
    null;

  const approved = submission?.status === "approved";

  return {
    gotrefsId: displayId,
    primarySport:
      profile.primary_sport || (typeof meta.primary_sport === "string" ? meta.primary_sport : null),
    additionalSports,
    certificationLevel:
      profile.certification_level ||
      (typeof meta.certification_level === "string" ? meta.certification_level : null),
    additionalCertificationLevels,
    certifiedBy: certifiedByRaw,
    baseCity: typeof meta.base_city === "string" ? meta.base_city : null,
    workRegions,
    avatarUrl,
    verificationStatus: submission?.status ?? null,
    validThrough: approved ? formatCardValidThrough(submission?.reviewed_at ?? null) : null,
    profileComplete: approved,
  };
}
