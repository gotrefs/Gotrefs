import { NextResponse, type NextRequest } from "next/server";
import { oauthCallbackUrl, oauthSignInOptions, parseOAuthProvider } from "@/lib/auth/oauth-providers";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(rawProvider);
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const cookieResponse = NextResponse.next();

  try {
    const supabase = createRouteHandlerClient(request, cookieResponse);

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
    cookieResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  } catch {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_start_failed&reason=missing_supabase_env", requestUrl.origin)
    );
  }
}
