import { NextResponse, type NextRequest } from "next/server";
import { validateName } from "@/lib/auth/validation";
import { dashboardPathForRole } from "@/lib/member-role";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type CompleteOAuthBody = {
  firstName?: string;
  lastName?: string;
  role?: "ref" | "organizer";
  isAssignor?: boolean;
  organizationName?: string;
  phone?: string;
  primarySport?: string;
  additionalSports?: string[];
  certificationLevel?: string;
  certifiedBy?: string;
  rateMin?: number;
  rateMax?: number;
  rateType?: "exact" | "range";
  rateUnit?: "hour" | "game";
  gotrefsId?: string;
  baseCity?: string;
  workRegions?: string[];
  travelRadius?: number | null;
  governingBodies?: string;
  crewInvite?: string;
  termsAccepted?: boolean;
  acceptedTermsSlug?: string;
};

export async function POST(request: NextRequest) {
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: CompleteOAuthBody;
  try {
    body = (await request.json()) as CompleteOAuthBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const role = body.role === "organizer" ? "organizer" : "ref";
  const isAssignor = body.isAssignor === true && role === "ref";
  const requiredTermsSlug = role === "organizer" ? "event-organizer-terms" : "referee-official-terms";
  const termsAccepted = body.termsAccepted === true && body.acceptedTermsSlug === requiredTermsSlug;

  const fnErr = validateName(firstName, "First name");
  if (fnErr) return NextResponse.json({ error: fnErr }, { status: 400 });
  const lnErr = validateName(lastName, "Last name");
  if (lnErr) return NextResponse.json({ error: lnErr }, { status: 400 });
  if (!termsAccepted) {
    return NextResponse.json(
      { error: "You must accept the applicable GotREFS terms and policies before continuing." },
      { status: 400 }
    );
  }

  const organizationName = (body.organizationName ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const primarySport = (body.primarySport ?? "").trim();
  const additionalSports = Array.isArray(body.additionalSports)
    ? body.additionalSports.filter((sport) => typeof sport === "string" && sport.trim()).map((sport) => sport.trim())
    : [];
  const certificationLevel = (body.certificationLevel ?? "").trim();
  const certifiedBy = (body.certifiedBy ?? "").trim();
  const rateMin =
    typeof body.rateMin === "number" && Number.isFinite(body.rateMin) ? body.rateMin : null;
  const rateMax =
    typeof body.rateMax === "number" && Number.isFinite(body.rateMax) ? body.rateMax : null;
  const rateType = body.rateType === "range" ? "range" : body.rateType === "exact" ? "exact" : null;
  const rateUnit = body.rateUnit === "game" ? "game" : body.rateUnit === "hour" ? "hour" : null;
  const gotrefsId = (body.gotrefsId ?? "").trim();
  const baseCity = (body.baseCity ?? "").trim();
  const workRegions = Array.isArray(body.workRegions)
    ? body.workRegions.filter((region) => typeof region === "string" && region.trim()).map((region) => region.trim())
    : [];
  const travelRadius =
    typeof body.travelRadius === "number" && Number.isFinite(body.travelRadius) ? body.travelRadius : null;
  const governingBodies = (body.governingBodies ?? "").trim();
  const crewInvite = (body.crewInvite ?? "").trim();
  const now = new Date().toISOString();
  const displayName = `${firstName} ${lastName}`.trim();

  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    full_name: displayName,
    organization_name: role === "organizer" ? organizationName : null,
    phone: role === "organizer" ? phone || null : null,
    role,
    primary_sport: role === "ref" ? primarySport || "Basketball" : null,
    additional_sports: role === "ref" ? additionalSports : [],
    certification_level: role === "ref" ? certificationLevel || "Youth / Recreational" : null,
    certified_by: role === "ref" ? certifiedBy || null : null,
    gotrefs_id: role === "ref" ? gotrefsId || null : null,
    base_city: role === "ref" ? baseCity || null : null,
    work_regions: role === "ref" ? workRegions : [],
    travel_radius_miles: role === "ref" ? travelRadius : null,
    is_assignor: isAssignor,
    governing_bodies: isAssignor ? governingBodies || null : null,
    crew_invite_seed: isAssignor ? crewInvite || null : null,
    accepted_terms_slug: requiredTermsSlug,
    accepted_terms_at: now,
    accepted_privacy_policy: true,
    accepted_payment_fee_policy: true,
    accepted_community_standards: true,
  };

  try {
    const admin = createServiceClient();
    await admin.auth.admin.updateUserById(user.id, { user_metadata: userMetadata });

    await admin
      .from("members")
      .upsert(
        {
          id: user.id,
          role,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          email: user.email?.trim().toLowerCase() || null,
          phone: role === "organizer" ? phone || null : null,
          organization_name: role === "organizer" ? organizationName || null : null,
          is_onboarded: true,
          last_login_at: now,
        },
        { onConflict: "id" }
      );

    if (role === "ref") {
      await admin.from("ref_profiles").upsert(
        {
          member_id: user.id,
          is_assignor: isAssignor,
          primary_sport: primarySport || "Basketball",
          additional_sports: additionalSports,
          certification_level: certificationLevel || "Youth / Recreational",
          gotrefs_id: gotrefsId || null,
          rate_type: rateType ?? (rateMin != null && rateMax != null ? "range" : "exact"),
          rate_min: rateMin,
          rate_max: rateMax,
          rate_per_game: rateType === "range" && rateMin != null ? rateMin : null,
          rate_unit: rateUnit ?? "hour",
          updated_at: now,
        },
        { onConflict: "member_id" }
      );
      await admin.from("screening_checks").upsert({ ref_member_id: user.id }, { onConflict: "ref_member_id" });
    } else {
      await admin.from("organizer_profiles").upsert({ member_id: user.id }, { onConflict: "member_id" });
    }

    return jsonWithSessionCookies(sessionResponse, {
      ok: true,
      role,
      redirect: dashboardPathForRole(role),
      message: "Profile setup complete.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete profile setup.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
