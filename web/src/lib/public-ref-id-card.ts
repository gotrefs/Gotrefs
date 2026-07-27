import { formatCardValidThrough } from "@/lib/ref-id-card-pdf";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { createServiceClient } from "@/lib/supabase/service";

export type PublicRefIdCard = {
  gotrefsId: string;
  primarySport: string | null;
  additionalSports: string[];
  certificationLevel: string | null;
  certifiedBy: string | null;
  baseCity: string | null;
  workRegions: string[];
  avatarUrl: string | null;
  verificationStatus: string | null;
  validThrough: string | null;
  profileComplete: boolean;
};

export function normalizeGotrefsId(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

function splitList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Load public ID card fields by GotREFS ID (no legal name/email/phone). */
export async function loadPublicRefIdCard(rawId: string): Promise<PublicRefIdCard | null> {
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) return null;

  const admin = createServiceClient();

  let { data: profile } = await admin
    .from("ref_profiles")
    .select("member_id, gotrefs_id, primary_sport, additional_sports, certification_level")
    .eq("gotrefs_id", gotrefsId)
    .maybeSingle();

  if (!profile) {
    const { data: rows } = await admin
      .from("ref_profiles")
      .select("member_id, gotrefs_id, primary_sport, additional_sports, certification_level")
      .ilike("gotrefs_id", gotrefsId)
      .limit(1);
    profile = rows?.[0] ?? null;
  }

  // Fallback: metadata may have gotrefs_id before ref_profiles was synced.
  if (!profile?.member_id) {
    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = listed.users.find((user) => {
      const metaId = user.user_metadata?.gotrefs_id;
      return typeof metaId === "string" && metaId.trim().toUpperCase() === gotrefsId;
    });
    if (match) {
      const { data: rp } = await admin
        .from("ref_profiles")
        .select("member_id, gotrefs_id, primary_sport, additional_sports, certification_level")
        .eq("member_id", match.id)
        .maybeSingle();
      profile = rp ?? {
        member_id: match.id,
        gotrefs_id: gotrefsId,
        primary_sport: typeof match.user_metadata?.primary_sport === "string" ? match.user_metadata.primary_sport : null,
        additional_sports: Array.isArray(match.user_metadata?.additional_sports)
          ? match.user_metadata.additional_sports
          : [],
        certification_level:
          typeof match.user_metadata?.certification_level === "string"
            ? match.user_metadata.certification_level
            : null,
      };
      // Best-effort sync for next scan.
      void admin
        .from("ref_profiles")
        .upsert(
          {
            member_id: match.id,
            gotrefs_id: gotrefsId,
          },
          { onConflict: "member_id" }
        );
    }
  }

  if (!profile?.member_id) return null;

  const [{ data: member }, { data: submission }, authResult] = await Promise.all([
    admin.from("members").select("profile_picture_url, role").eq("id", profile.member_id).maybeSingle(),
    admin
      .from("ref_verification_submissions")
      .select("status, reviewed_at")
      .eq("ref_member_id", profile.member_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(profile.member_id),
  ]);

  if (member?.role && member.role !== "ref") return null;

  const meta = authResult.data.user?.user_metadata ?? {};
  const metaGotrefs = typeof meta.gotrefs_id === "string" ? meta.gotrefs_id.trim() : "";
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

  const workRegions = Array.isArray(meta.work_regions)
    ? meta.work_regions.filter((s: unknown): s is string => typeof s === "string")
    : [];

  const certifiedBy =
    typeof meta.certified_by === "string"
      ? meta.certified_by
      : splitList(typeof meta.certified_by === "string" ? meta.certified_by : null).join(", ");

  const approved = submission?.status === "approved";

  return {
    gotrefsId: displayId,
    primarySport:
      profile.primary_sport || (typeof meta.primary_sport === "string" ? meta.primary_sport : null),
    additionalSports,
    certificationLevel:
      profile.certification_level ||
      (typeof meta.certification_level === "string" ? meta.certification_level : null),
    certifiedBy: typeof meta.certified_by === "string" ? meta.certified_by : certifiedBy || null,
    baseCity: typeof meta.base_city === "string" ? meta.base_city : null,
    workRegions,
    avatarUrl,
    verificationStatus: submission?.status ?? null,
    validThrough: approved ? formatCardValidThrough(submission?.reviewed_at ?? null) : null,
    profileComplete: approved,
  };
}
