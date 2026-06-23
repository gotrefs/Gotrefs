import { NextResponse, type NextRequest } from "next/server";
import { confirmUserEmail, findUserByEmail } from "@/lib/auth/admin-users";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { validatePasswordStrength } from "@/lib/auth/password";
import { validateEmail, validateName } from "@/lib/auth/validation";
import { serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type RegisterBody = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: "ref" | "organizer";
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
  verificationSkipped?: boolean;
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
  const verificationSkipped = body.verificationSkipped === true;

  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const fnErr = validateName(firstName, "First name");
  if (fnErr) return NextResponse.json({ error: fnErr }, { status: 400 });

  const lnErr = validateName(lastName, "Last name");
  if (lnErr) return NextResponse.json({ error: lnErr }, { status: 400 });

  const pwErr = validatePasswordStrength(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

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
    verification_skipped: role === "ref" ? verificationSkipped : false,
  };

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    admin = null;
  }

  if (admin) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    let authUser = created.user;

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        authUser = await findUserByEmail(admin, email);
        if (!authUser) {
          return NextResponse.json({ error: createErr.message }, { status: 400 });
        }
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: userMetadata,
          password,
        });
        await confirmUserEmail(admin, authUser.id);
      } else {
        return NextResponse.json({ error: createErr.message }, { status: 400 });
      }
    }

    if (authUser) {
      await syncMemberAccount(admin, authUser);
      if (role === "ref") {
        await admin
          .from("ref_profiles")
          .update({
            primary_sport: primarySport || "Basketball",
            additional_sports: additionalSports,
            certification_level: certificationLevel || "Youth / Recreational",
            updated_at: new Date().toISOString(),
          })
          .eq("member_id", authUser.id);
      }
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      return NextResponse.json({ error: signInErr.message }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const sync = user ? await syncMemberAccount(admin, user) : { ok: true, role: role as "ref" | "organizer" };

    return jsonWithSessionCookies(sessionResponse, {
      ok: true,
      needsEmailConfirmation: false,
      role: sync.role,
      redirect: "/dashboard",
    });
  }

  const siteUrl = serverEnv.siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: userMetadata,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payload = {
    ok: true,
    needsEmailConfirmation: !data.session,
    userId: data.user?.id ?? null,
    role,
    redirect: "/dashboard",
  };

  if (data.session) {
    if (role === "ref" && data.user?.id) {
      await supabase
        .from("ref_profiles")
        .update({
          primary_sport: primarySport || "Basketball",
          additional_sports: additionalSports,
          certification_level: certificationLevel || "Youth / Recreational",
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", data.user.id);
    }
    return jsonWithSessionCookies(sessionResponse, payload);
  }

  return NextResponse.json(payload);
}
