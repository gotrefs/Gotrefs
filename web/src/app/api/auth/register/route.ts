import { NextResponse, type NextRequest } from "next/server";
import { confirmUserEmail, findUserByEmail } from "@/lib/auth/admin-users";
import { validatePasswordStrength } from "@/lib/auth/password";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { validateEmail, validateName } from "@/lib/auth/validation";
import { serverEnv } from "@/lib/env/server";
import { dashboardPathForRole } from "@/lib/member-role";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterBody = {
  email?: string;
  password?: string;
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
  gotrefsId?: string;
  baseCity?: string;
  workRegions?: string[];
  travelRadius?: number | null;
  governingBodies?: string;
  crewInvite?: string;
  verificationSkipped?: boolean;
  termsAccepted?: boolean;
  acceptedTermsSlug?: string;
};

export async function POST(request: NextRequest) {
  try {
    serverEnv.supabaseUrl();
    serverEnv.supabaseAnonKey();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured. Set Supabase env vars in .env.local." },
      { status: 503 }
    );
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const role = body.role === "organizer" ? "organizer" : "ref";
  const isAssignor = body.isAssignor === true && role === "ref";
  const organizationName = (body.organizationName ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const primarySport = (body.primarySport ?? "").trim();
  const additionalSports = Array.isArray(body.additionalSports)
    ? body.additionalSports.filter((sport) => typeof sport === "string" && sport.trim()).map((sport) => sport.trim())
    : [];
  const certificationLevel = (body.certificationLevel ?? "").trim();
  const certifiedBy = (body.certifiedBy ?? "").trim();
  const gotrefsId = (body.gotrefsId ?? "").trim();
  const baseCity = (body.baseCity ?? "").trim();
  const workRegions = Array.isArray(body.workRegions)
    ? body.workRegions.filter((region) => typeof region === "string" && region.trim()).map((region) => region.trim())
    : [];
  const travelRadius =
    typeof body.travelRadius === "number" && Number.isFinite(body.travelRadius) ? body.travelRadius : null;
  const governingBodies = (body.governingBodies ?? "").trim();
  const crewInvite = (body.crewInvite ?? "").trim();
  const verificationSkipped = body.verificationSkipped === true;
  const requiredTermsSlug = role === "organizer" ? "event-organizer-terms" : "referee-official-terms";
  const termsAccepted = body.termsAccepted === true && body.acceptedTermsSlug === requiredTermsSlug;

  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const fnErr = validateName(firstName, "First name");
  if (fnErr) return NextResponse.json({ error: fnErr }, { status: 400 });

  const lnErr = validateName(lastName, "Last name");
  if (lnErr) return NextResponse.json({ error: lnErr }, { status: 400 });

  const pwErr = validatePasswordStrength(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  if (!termsAccepted) {
    return NextResponse.json(
      { error: "You must accept the applicable GotREFS terms and policies before creating an account." },
      { status: 400 }
    );
  }

  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
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
    verification_skipped: role === "ref" ? verificationSkipped : false,
    accepted_terms_slug: requiredTermsSlug,
    accepted_terms_at: new Date().toISOString(),
    accepted_privacy_policy: true,
    accepted_payment_fee_policy: true,
    accepted_community_standards: true,
  };

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  try {
    const admin = createServiceClient();
    const existingUser = await findUserByEmail(admin, email);
    if (existingUser) {
      const providers = Array.isArray(existingUser.app_metadata?.providers)
        ? existingUser.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
        : [];
      const identityProviders =
        existingUser.identities
          ?.map((identity) => identity.provider)
          .filter((provider): provider is string => typeof provider === "string") ?? [];
      const allProviders = Array.from(new Set([...providers, ...identityProviders]));
      return NextResponse.json(
        {
          error: allProviders.includes("google")
            ? "That email already has a GotREFS account connected to Google. Use Continue with Google."
            : "That email already has a GotREFS account. Log in instead, or use a different email.",
        },
        { status: 409 }
      );
    }
  } catch {
    // If service-role lookup is unavailable, continue and let Supabase handle signup.
  }

  const siteUrl = serverEnv.siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      data: userMetadata,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = data.user?.id ?? null;
  let redirect = dashboardPathForRole(role);

  if (!data.session && userId) {
    try {
      const admin = createServiceClient();
      await confirmUserEmail(admin, userId);
      const sync = await syncMemberAccount(admin, data.user!);
      redirect = dashboardPathForRole(sync.role);
    } catch {
      return NextResponse.json(
        {
          error:
            "Account created, but auto-confirm is not configured. Add SUPABASE_SERVICE_ROLE_KEY locally or disable email confirmation in Supabase Auth.",
        },
        { status: 503 }
      );
    }
  }

  const { data: signInData, error: signInError } = data.session
    ? { data, error: null }
    : await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return NextResponse.json(
      {
        error:
          signInError.message.toLowerCase().includes("invalid login credentials")
            ? "That email may already have a GotREFS account, or the account could not be created. Try logging in, using Continue with Google, or use a different email."
            : signInError.message,
      },
      { status: 400 }
    );
  }

  if (isAssignor && userId) {
    try {
      const admin = createServiceClient();
      await admin
        .from("ref_profiles")
        .upsert(
          {
            member_id: userId,
            is_assignor: true,
            primary_sport: primarySport || "Basketball",
            additional_sports: additionalSports,
            certification_level: certificationLevel || "Youth / Recreational",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
    } catch {
      return NextResponse.json(
        { error: "Account created, but assignor mode could not be enabled." },
        { status: 503 }
      );
    }
  } else if (role === "ref" && userId) {
    try {
      const admin = createServiceClient();
      await admin
        .from("ref_profiles")
        .upsert(
          {
            member_id: userId,
            primary_sport: primarySport || "Basketball",
            additional_sports: additionalSports,
            certification_level: certificationLevel || "Youth / Recreational",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
    } catch {
      // Profile row is created by trigger; non-fatal if upsert fails.
    }
  }

  return jsonWithSessionCookies(sessionResponse, {
    ok: true,
    needsEmailConfirmation: false,
    userId: signInData.user?.id ?? userId,
    role,
    redirect,
    message: "Account created. You are signed in.",
  });
}
