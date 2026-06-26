import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Auth links can land on the Site URL or auth pages — forward once to callback.
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const canForwardAuthCode = pathname === "/" || pathname === "/auth/login" || pathname === "/auth/signup";
  if (canForwardAuthCode && (code || (tokenHash && type))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", "/dashboard");
    }
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname === "/auth/login" || pathname === "/auth/signup";

  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged-in users should not stay on login/signup (unless ?error= is present).
  if (user && isAuthPage && !request.nextUrl.searchParams.get("error")) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}
