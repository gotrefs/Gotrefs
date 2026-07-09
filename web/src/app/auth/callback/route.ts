import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { resolveEmailCallbackRedirect } from "@/lib/auth/email-confirmation";
import { gotrefsAdminDashboardPath, isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { ensureAdminOAuthMember } from "@/lib/auth/bootstrap-admin-oauth";
import { upsertOAuthMember } from "@/lib/auth/oauth";
import { parseOAuthProvider, type OAuthProvider } from "@/lib/auth/oauth-providers";
import { resolvePostOAuthRedirect } from "@/lib/auth/oauth-redirect";
import { resolveAuthenticatedHomePath } from "@/lib/auth/onboarding-redirect";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import {
  applyRouteHandlerCookies,
  createRouteHandlerClientWithCookieBuffer,
  safeRedirectPath,
  type RouteHandlerCookie,
} from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

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

function redirectWithAuthCookies(
  origin: string,
  cookieBuffer: RouteHandlerCookie[],
  destination: string | URL
) {
  const target = typeof destination === "string" ? new URL(destination, origin) : destination;
  const redirect = NextResponse.redirect(target);
  applyRouteHandlerCookies(redirect, cookieBuffer);
  return redirect;
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

  const cookieBuffer: RouteHandlerCookie[] = [];

  try {
    const supabase = createRouteHandlerClientWithCookieBuffer(request, cookieBuffer);

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
          return redirectWithAuthCookies(
            requestUrl.origin,
            cookieBuffer,
            gotrefsAdminDashboardPath()
          );
        }
        const member = await upsertOAuthMember(admin, user, provider);
        const destination = resolvePostOAuthRedirect(requestUrl.origin, member, next, user.email);
        return redirectWithAuthCookies(requestUrl.origin, cookieBuffer, destination);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "oauth_callback_failed";
        console.error("[auth/callback] oauth member sync:", reason);
        const fallback = isGotrefsAdminUser(user)
          ? gotrefsAdminDashboardPath()
          : user.user_metadata?.role === "organizer"
            ? "/dashboard/organizer"
            : "/dashboard/referee";
        return redirectWithAuthCookies(requestUrl.origin, cookieBuffer, fallback);
      }
    }

    // Email confirmation link (non-OAuth)
    try {
      const admin = createServiceClient();
      await syncMemberAccount(admin, user);
      await admin
        .from("members")
        .update({
          is_onboarded: true,
          last_login_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (isGotrefsAdminUser(user)) {
        redirectPath = gotrefsAdminDashboardPath();
      } else if (redirectPath === "/dashboard") {
        const { data: member } = await admin
          .from("members")
          .select("is_onboarded, role")
          .eq("id", user.id)
          .maybeSingle();
        redirectPath = resolveAuthenticatedHomePath({
          member,
          email: user.email,
          next,
        });
      } else if (redirectPath.startsWith("/dashboard")) {
        redirectPath = resolveEmailCallbackRedirect(user, redirectPath);
      }
    } catch {
      if (redirectPath === "/dashboard") {
        redirectPath =
          user.user_metadata?.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
      }
    }

    return redirectWithAuthCookies(requestUrl.origin, cookieBuffer, redirectPath);
  } catch (err) {
    console.error("[auth/callback] unexpected:", err);
    return authErrorRedirect(requestUrl.origin, oauthFlow, "server_error");
  }
}
