import { NextResponse, type NextRequest } from "next/server";
import { parseOAuthProvider } from "@/lib/auth/oauth";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(rawProvider);
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const response = NextResponse.next();
  const supabase = createRouteHandlerClient(request, response);

  const redirectTo = new URL(`/api/auth/callback/${provider}`, requestUrl.origin);
  redirectTo.searchParams.set("next", next.startsWith("/") ? next : "/dashboard");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString(),
      scopes:
        provider === "apple"
          ? "name email"
          : provider === "facebook"
            ? "email,public_profile"
            : "openid email profile",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=oauth_start_failed&reason=${encodeURIComponent(error?.message ?? "No URL")}`, requestUrl.origin)
    );
  }

  const redirect = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}
