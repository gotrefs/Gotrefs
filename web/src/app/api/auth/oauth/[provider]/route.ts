import { NextResponse, type NextRequest } from "next/server";
import { oauthCallbackUrl, oauthSignInOptions, parseOAuthProvider } from "@/lib/auth/oauth-providers";
import {
  applyRouteHandlerCookies,
  createRouteHandlerClientWithCookieBuffer,
  safeRedirectPath,
  type RouteHandlerCookie,
} from "@/lib/supabase/route-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(rawProvider);
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  try {
    const cookieBuffer: RouteHandlerCookie[] = [];
    const supabase = createRouteHandlerClientWithCookieBuffer(request, cookieBuffer);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthSignInOptions(provider, oauthCallbackUrl(requestUrl.origin, provider, next)),
    });

    if (error || !data.url) {
      return NextResponse.redirect(
        new URL(
          `/auth/login?error=oauth_start_failed&reason=${encodeURIComponent(error?.message ?? "No URL")}`,
          requestUrl.origin
        )
      );
    }

    const redirect = NextResponse.redirect(data.url);
    redirect.headers.set("Cache-Control", "no-store");
    applyRouteHandlerCookies(redirect, cookieBuffer);
    return redirect;
  } catch {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_start_failed&reason=missing_supabase_env", requestUrl.origin)
    );
  }
}
