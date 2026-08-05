import { NextResponse, type NextRequest } from "next/server";
import {
  buildEmailConfirmationRedirectUrl,
  safeSignupRedirectPath,
} from "@/lib/auth/email-confirmation";
import { sendCrossDeviceSignupConfirmationEmail } from "@/lib/auth/send-signup-confirmation";
import { validateEmail } from "@/lib/auth/validation";
import { resolveSiteUrlFromRequest, serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

type ResendBody = {
  email?: string;
  pendingRedirect?: string;
};

export async function POST(request: NextRequest) {
  try {
    serverEnv.supabaseUrl();
    serverEnv.supabaseAnonKey();
  } catch {
    return NextResponse.json(
      { error: "Server is not configured. Set Supabase env vars in .env.local." },
      { status: 503 }
    );
  }

  let body: ResendBody;
  try {
    body = (await request.json()) as ResendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const pendingRedirect = safeSignupRedirectPath(body.pendingRedirect);
  const siteUrl = resolveSiteUrlFromRequest(request);

  // Prefer token_hash magic links (work on any device). Fall back to Supabase resend.
  try {
    const admin = createServiceClient();
    const result = await sendCrossDeviceSignupConfirmationEmail({
      admin,
      email,
      siteUrl,
      pendingRedirect,
    });
    if (result.sent) {
      return NextResponse.json({
        ok: true,
        message: "Verification email sent. Use the newest email — the link works on phone or computer.",
      });
    }
    console.warn("[resend-verification] cross-device send failed:", result.error);
  } catch (err) {
    console.warn("[resend-verification] generateLink unavailable:", err);
  }

  const emailRedirectTo = buildEmailConfirmationRedirectUrl(siteUrl, pendingRedirect);
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit")) {
      return NextResponse.json(
        {
          error:
            "Too many emails sent. Wait a few minutes before requesting another verification link.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return jsonWithSessionCookies(sessionResponse, {
    ok: true,
    message: "Verification email sent. Check your inbox and spam folder.",
  });
}
