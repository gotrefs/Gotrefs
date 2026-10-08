import { NextResponse, type NextRequest } from "next/server";
import { PRIMARY_SPORTS } from "@/data/sports";
import { issueUniqueGotrefsId } from "@/lib/auth/gotrefs-id";
import { validateName } from "@/lib/auth/validation";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type Body = {
  firstName?: string;
  lastName?: string;
  primarySport?: string;
  termsAccepted?: boolean;
};

const TERMS_SLUG = "referee-official-terms";

/**
 * Quick referee signup after Google / Apple sign-in: name + sport only.
 * Verification documents (face photo, government ID, certification) are collected
 * later, the first time the ref asks to work a game.
 */
export async function POST(request: NextRequest) {
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const primarySport = (body.primarySport ?? "").trim();

  const fnErr = validateName(firstName, "First name");
  if (fnErr) return NextResponse.json({ error: fnErr }, { status: 400 });
  const lnErr = validateName(lastName, "Last name");
  if (lnErr) return NextResponse.json({ error: lnErr }, { status: 400 });
  if (!(PRIMARY_SPORTS as readonly string[]).includes(primarySport)) {
    return NextResponse.json({ error: "Pick the sport you REFeree." }, { status: 400 });
  }
  if (body.termsAccepted !== true) {
    return NextResponse.json({ error: "Accept the REFeree terms to continue." }, { status: 400 });
  }

  try {
    const admin = createServiceClient();

    const { data: existing } = await admin
      .from("members")
      .select("role, is_onboarded")
      .eq("id", user.id)
      .maybeSingle();
    if (existing?.is_onboarded && existing.role === "organizer") {
      return NextResponse.json(
        { error: "This account is already set up as an event organizer." },
        { status: 409 }
      );
    }

    const { data: currentProfile } = await admin
      .from("ref_profiles")
      .select("gotrefs_id")
      .eq("member_id", user.id)
      .maybeSingle();
    const gotrefsId = currentProfile?.gotrefs_id?.trim() || (await issueUniqueGotrefsId(admin));

    const now = new Date().toISOString();
    const displayName = `${firstName} ${lastName}`.trim();

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        role: "ref",
        first_name: firstName,
        last_name: lastName,
        full_name: displayName,
        primary_sport: primarySport,
        gotrefs_id: gotrefsId,
        accepted_terms_slug: TERMS_SLUG,
        accepted_terms_at: now,
        accepted_privacy_policy: true,
        accepted_payment_fee_policy: true,
        accepted_community_standards: true,
      },
    });

    const { error: memberError } = await admin.from("members").upsert(
      {
        id: user.id,
        role: "ref",
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        email: user.email?.trim().toLowerCase() || null,
        is_onboarded: true,
        last_login_at: now,
      },
      { onConflict: "id" }
    );
    if (memberError) throw new Error(memberError.message);

    const { error: profileError } = await admin.from("ref_profiles").upsert(
      {
        member_id: user.id,
        primary_sport: primarySport,
        gotrefs_id: gotrefsId,
        updated_at: now,
      },
      { onConflict: "member_id" }
    );
    if (profileError) throw new Error(profileError.message);

    await admin.from("screening_checks").upsert({ ref_member_id: user.id }, { onConflict: "ref_member_id" });

    return jsonWithSessionCookies(sessionResponse, {
      ok: true,
      gotrefsId,
      redirect: "/dashboard/referee",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not finish signup.";
    console.error("[api/auth/quick-ref-signup]", message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
