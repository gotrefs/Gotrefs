import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { gotrefsAdminDashboardPath, isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { ensureAdminOAuthMember } from "@/lib/auth/bootstrap-admin-oauth";
import { upsertOAuthMember } from "@/lib/auth/oauth";
import { parseOAuthProvider, type OAuthProvider } from "@/lib/auth/oauth-providers";
import { resolvePostOAuthRedirect } from "@/lib/auth/oauth-redirect";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { dashboardPathForRole } from "@/lib/member-role";
import { createRouteHandlerClient, safeRedirectPath } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

function redirectWithCookies(from: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}

function oauthProviderFromRequest(requestUrl: URL, userProvider?: string | null): OAuthProvider | null {
  const raw = requestUrl.searchParams.get("provider") ?? userProvider;
  if (!raw) return null;
  try {
    return parseOAuthProvider(raw);
  } catch {
    return null;
  }
}

function authErrorRedirect(origin: string, oauthFlow: boolean, reason: string) {
  const errorCode = oauthFlow ? "oauth_failed" : "confirmation_failed";
  return NextResponse.redirect(
    new URL(`/auth/login?error=${errorCode}&reason=${encodeURIComponent(reason)}`, origin)
  );
}

/** Exchange auth codes for a session (email links + Google/Apple/Facebook OAuth). */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));
  const oauthFlow = Boolean(requestUrl.searchParams.get("provider"));

  if (!code && !(tokenHash && type)) {
    return authErrorRedirect(requestUrl.origin, oauthFlow, "missing_code");
  }

  const sessionResponse = NextResponse.redirect(new URL(next, requestUrl.origin));

  try {
    const supabase = createRouteHandlerClient(request, sessionResponse);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
        return authErrorRedirect(requestUrl.origin, oauthFlow, error.message);
      }
    } else {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type as EmailOtpType,
      });
      if (error) {
        console.error("[auth/callback] verifyOtp:", error.message);
        return authErrorRedirect(requestUrl.origin, false, error.message);
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return authErrorRedirect(requestUrl.origin, oauthFlow, "missing_user");
    }

    let redirectPath = next;

    const provider =
      oauthProviderFromRequest(requestUrl, user.app_metadata?.provider as string | undefined) ??
      (user.identities?.[0]?.provider
        ? oauthProviderFromRequest(requestUrl, user.identities[0].provider)
        : null);

    if (provider) {
      try {
        const admin = createServiceClient();
        if (isGotrefsAdminUser(user)) {
          await ensureAdminOAuthMember(admin, user);
          return redirectWithCookies(
            sessionResponse,
            new URL(gotrefsAdminDashboardPath(), requestUrl.origin)
          );
        }
        const member = await upsertOAuthMember(admin, user, provider);
        const destination = resolvePostOAuthRedirect(requestUrl.origin, member, next, user.email);
        return redirectWithCookies(sessionResponse, destination);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "oauth_callback_failed";
        console.error("[auth/callback] oauth member sync:", reason);
        return authErrorRedirect(requestUrl.origin, true, reason);
      }
    }

    if (redirectPath === "/dashboard") {
      if (isGotrefsAdminUser(user)) {
        redirectPath = gotrefsAdminDashboardPath();
      } else {
        try {
          const admin = createServiceClient();
          const sync = await syncMemberAccount(admin, user);
          redirectPath = dashboardPathForRole(sync.role);
        } catch {
          redirectPath =
            user.user_metadata?.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
        }
      }
    }

    if (redirectPath !== next) {
      return redirectWithCookies(sessionResponse, new URL(redirectPath, requestUrl.origin));
    }

    return sessionResponse;
  } catch (err) {
    console.error("[auth/callback] unexpected:", err);
    return authErrorRedirect(requestUrl.origin, oauthFlow, "server_error");
  }
}
