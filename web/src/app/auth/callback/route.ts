import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteHandlerClient, safeRedirectPath } from "@/lib/supabase/route-handler";

/** Exchange email confirmation / magic-link codes for a session cookie. */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  const successUrl = new URL(next, requestUrl.origin);
  let response = NextResponse.redirect(successUrl);

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
      return response;
    }

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
    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected:", err);
    return NextResponse.redirect(
      new URL("/auth/login?error=confirmation_failed&reason=server_error", requestUrl.origin)
    );
  }
}
