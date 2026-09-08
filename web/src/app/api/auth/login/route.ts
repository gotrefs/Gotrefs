import { NextResponse, type NextRequest } from "next/server";
import { confirmUserEmail, findUserByEmail } from "@/lib/auth/admin-users";
import { gotrefsAdminDashboardPath, isGotrefsAdminEmail, isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { ensureAdminOAuthMember } from "@/lib/auth/bootstrap-admin-oauth";
import { resolveAuthenticatedHomePath } from "@/lib/auth/onboarding-redirect";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { validateEmail } from "@/lib/auth/validation";
import { isOAuthProviderEnabled } from "@/lib/auth/oauth-provider-flags";
import { serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type LoginBody = {
  email?: string;
  password?: string;
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

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const skipConfirmation = serverEnv.skipEmailConfirmation();

  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("email not confirmed")) {
      if (!skipConfirmation) {
        return NextResponse.json(
          {
            error:
              "Please confirm your email address first. Check your inbox for the verification link, or sign up again to resend it.",
            needsEmailConfirmation: true,
          },
          { status: 403 }
        );
      }

      try {
        const admin = createServiceClient();
        const authUser = await findUserByEmail(admin, email);
        if (authUser) {
          await confirmUserEmail(admin, authUser.id);
          const retry = await supabase.auth.signInWithPassword({ email, password });
          data = retry.data;
          error = retry.error;
        }
      } catch {
        return NextResponse.json(
          {
            error:
              "This account is not confirmed yet, and auto-confirm is not configured. Add SUPABASE_SERVICE_ROLE_KEY locally.",
          },
          { status: 503 }
        );
      }
      if (error) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
    } else {
      try {
        const admin = createServiceClient();
        const authUser = await findUserByEmail(admin, email);
        if (!authUser) {
          return NextResponse.json(
            { error: "No GotREFS account exists for that email. Click Sign up to create one." },
            { status: 404 }
          );
        }
        const providers = Array.isArray(authUser.app_metadata?.providers)
          ? authUser.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
          : [];
        const identityProviders =
          authUser.identities
            ?.map((identity) => identity.provider)
            .filter((provider): provider is string => typeof provider === "string") ?? [];
        if ([...providers, ...identityProviders].includes("google")) {
          const googleEnabled = isOAuthProviderEnabled("google");
          return NextResponse.json(
            {
              error: googleEnabled
                ? "This account is connected to Google. Use Continue with Google instead of a password."
                : "This account was created with Google and does not have a password yet. Click Forgot password on the login screen to set one.",
              needsPasswordSetup: !googleEnabled,
            },
            { status: 401 }
          );
        }
      } catch {
        // Fall back to the generic message if admin lookup is unavailable.
      }
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
  }

  let role: "ref" | "organizer" = "ref";
  let member: { is_onboarded: boolean; role: string } | null = null;
  const sessionEmail = data.user?.email?.trim().toLowerCase() ?? email;

  try {
    const admin = createServiceClient();
    if (data.user) {
      if (isGotrefsAdminEmail(sessionEmail)) {
        await ensureAdminOAuthMember(admin, data.user);
      } else {
        const sync = await syncMemberAccount(admin, data.user);
        role = sync.role;
        const { data: memberRow } = await admin
          .from("members")
          .select("is_onboarded, role")
          .eq("id", data.user.id)
          .maybeSingle();
        member = memberRow;
      }
    }
  } catch {
    role = data.user?.user_metadata?.role === "organizer" ? "organizer" : "ref";
  }

  const redirect =
    isGotrefsAdminUser(data.user) || isGotrefsAdminEmail(sessionEmail)
      ? gotrefsAdminDashboardPath()
      : resolveAuthenticatedHomePath({
          member,
          email: sessionEmail,
        });

  return jsonWithSessionCookies(sessionResponse, {
    ok: true,
    userId: data.user?.id ?? null,
    role,
    redirect,
  });
}
