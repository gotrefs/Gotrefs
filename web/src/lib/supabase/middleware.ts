import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  memberNeedsOnboarding,
  resolveAuthenticatedHomePath,
} from "@/lib/auth/onboarding-redirect";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { dashboardPathForRole } from "@/lib/member-role";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Do not refresh sessions during OAuth handshakes — it can clear PKCE cookies.
  if (
    pathname.startsWith("/api/auth/oauth") ||
    pathname.startsWith("/api/auth/callback") ||
    pathname === "/auth/callback"
  ) {
    return NextResponse.next({ request });
  }

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

  let member: { is_onboarded: boolean; role: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("members")
      .select("is_onboarded, role")
      .eq("id", user.id)
      .maybeSingle();
    member = data;
  }

  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/auth/update-password";
  const nextPath = request.nextUrl.searchParams.get("next");

  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isDashboard && user && !isGotrefsAdminUser(user)) {
    if (memberNeedsOnboarding(member)) {
      const signupUrl = request.nextUrl.clone();
      signupUrl.pathname = "/auth/signup";
      signupUrl.search = "";
      signupUrl.searchParams.set("oauth", "1");
      signupUrl.searchParams.set("step", "role");
      if (pathname !== "/dashboard") {
        signupUrl.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(signupUrl);
    }

    if (pathname === "/dashboard" && member?.role) {
      const roleDashboard = request.nextUrl.clone();
      roleDashboard.pathname = dashboardPathForRole(
        member.role === "organizer" ? "organizer" : "ref"
      );
      roleDashboard.search = "";
      return NextResponse.redirect(roleDashboard);
    }
  }

  // Logged-in users should not stay on login/signup (unless finishing OAuth onboarding or setting a password).
  if (user && isAuthPage && !request.nextUrl.searchParams.get("error")) {
    const finishingOAuthSignup =
      pathname === "/auth/signup" && request.nextUrl.searchParams.get("oauth") === "1";
    const settingPassword = pathname === "/auth/update-password";
    if (!finishingOAuthSignup && !settingPassword) {
      const destination = resolveAuthenticatedHomePath({
        member,
        email: user.email,
        next: nextPath,
      });
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = destination.split("?")[0];
      const query = destination.includes("?") ? destination.split("?")[1] : "";
      dashUrl.search = query ? `?${query}` : "";
      return NextResponse.redirect(dashUrl);
    }
  }

  return supabaseResponse;
}
