import { NextResponse, type NextRequest } from "next/server";
import { buildAuthCallbackUrl } from "@/lib/auth/email-confirmation";
import { validateEmail } from "@/lib/auth/validation";
import { resolveSiteUrlFromRequest, serverEnv } from "@/lib/env/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";

type ForgotPasswordBody = {
  email?: string;
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

  let body: ForgotPasswordBody;
  try {
    body = (await request.json()) as ForgotPasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

  const redirectTo = buildAuthCallbackUrl(
    resolveSiteUrlFromRequest(request),
    "/auth/update-password"
  );

  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit")) {
      return NextResponse.json(
        { error: "Too many emails sent. Wait a few minutes and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return jsonWithSessionCookies(sessionResponse, {
    ok: true,
    message: "If an account exists for that email, we sent a link to set or reset your password.",
  });
}
