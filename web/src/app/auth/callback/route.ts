import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
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

/** Exchange email confirmation / magic-link codes for a session cookie. */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(
      new URL("/auth/login?error=confirmation_failed&reason=missing_code", requestUrl.origin)
    );
  }

  try {
    const supabase = createRouteHandlerClient(request, response);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
        return NextResponse.redirect(
          new URL(
            `/auth/login?error=confirmation_failed&reason=${encodeURIComponent(error.message)}`,
            requestUrl.origin
          )
        );
      }
    } else {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type as EmailOtpType,
      });
      if (error) {
        console.error("[auth/callback] verifyOtp:", error.message);
        return NextResponse.redirect(
          new URL(
            `/auth/login?error=confirmation_failed&reason=${encodeURIComponent(error.message)}`,
            requestUrl.origin
          )
        );
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let redirectPath = next;
    if (user && redirectPath === "/dashboard") {
      try {
        const admin = createServiceClient();
        const sync = await syncMemberAccount(admin, user);
        redirectPath = dashboardPathForRole(sync.role);
      } catch {
        redirectPath =
          user.user_metadata?.role === "organizer"
            ? "/dashboard/organizer"
            : "/dashboard/referee";
      }
    }

    if (redirectPath !== next) {
      return redirectWithCookies(response, new URL(redirectPath, requestUrl.origin));
    }
    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected:", err);
    return NextResponse.redirect(
      new URL("/auth/login?error=confirmation_failed&reason=server_error", requestUrl.origin)
    );
  }
}
