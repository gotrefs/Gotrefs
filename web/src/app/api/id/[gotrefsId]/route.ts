import { NextResponse } from "next/server";
import { formatCardValidThrough } from "@/lib/ref-id-card-pdf";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = { params: Promise<{ gotrefsId: string }> };

function normalizeGotrefsId(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

/**
 * Public referee ID card payload (photo + card fields, no legal name/email/phone).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { gotrefsId: rawId } = await context.params;
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) {
    return NextResponse.json({ error: "Invalid GotREFS ID." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  // Prefer exact match, then case-insensitive.
  let { data: profile } = await admin
    .from("ref_profiles")
    .select(
      "member_id, gotrefs_id, primary_sport, additional_sports, certification_level"
    )
    .eq("gotrefs_id", gotrefsId)
    .maybeSingle();

  if (!profile) {
    const { data: rows } = await admin
      .from("ref_profiles")
      .select(
        "member_id, gotrefs_id, primary_sport, additional_sports, certification_level"
      )
      .ilike("gotrefs_id", gotrefsId)
      .limit(1);
    profile = rows?.[0] ?? null;
  }

  if (!profile?.member_id) {
    return NextResponse.json({ error: "Official ID not found." }, { status: 404 });
  }

  const [{ data: member }, { data: submission }, authResult] = await Promise.all([
    admin
      .from("members")
      .select("profile_picture_url, role")
      .eq("id", profile.member_id)
      .maybeSingle(),
    admin
      .from("ref_verification_submissions")
      .select("status, reviewed_at")
      .eq("ref_member_id", profile.member_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(profile.member_id),
  ]);

  if (member?.role && member.role !== "ref") {
    return NextResponse.json({ error: "Official ID not found." }, { status: 404 });
  }

  const meta = authResult.data.user?.user_metadata ?? {};
  const metaGotrefs =
    typeof meta.gotrefs_id === "string" ? meta.gotrefs_id.trim() : "";
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

  const approved = submission?.status === "approved";
  const validThrough = approved
    ? formatCardValidThrough(submission?.reviewed_at ?? null)
    : null;

  return NextResponse.json({
    card: {
      gotrefsId: displayId,
      primarySport:
        profile.primary_sport ||
        (typeof meta.primary_sport === "string" ? meta.primary_sport : null),
      additionalSports,
      certificationLevel:
        profile.certification_level ||
        (typeof meta.certification_level === "string" ? meta.certification_level : null),
      certifiedBy: typeof meta.certified_by === "string" ? meta.certified_by : null,
      baseCity: typeof meta.base_city === "string" ? meta.base_city : null,
      workRegions,
      avatarUrl,
      verificationStatus: submission?.status ?? null,
      validThrough,
      profileComplete: approved,
    },
  });
}
