import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { parseOAuthProvider } from "@/lib/auth/oauth";

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    maxAge?: number;
    domain?: string;
    sameSite?: boolean | "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
    expires?: Date;
  };
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await context.params;
  const requestUrl = new URL(request.url);
  const provider = parseOAuthProvider(rawProvider);
  const next = requestUrl.searchParams.get("next") || "/dashboard";
  const cookiesToSet: CookieToSet[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL("/auth/login?error=oauth_start_failed&reason=missing_supabase_env", requestUrl.origin)
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet.push(...nextCookies);
      },
    },
  });

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
  cookiesToSet.forEach(({ name, value, options }) => {
    redirect.cookies.set(name, value, { ...options, path: options?.path ?? "/" });
  });
  return redirect;
}
