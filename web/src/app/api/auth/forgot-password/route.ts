import { NextResponse, type NextRequest } from "next/server";
import { validateEmail } from "@/lib/auth/validation";
import { resolveSiteUrlFromRequest, serverEnv } from "@/lib/env/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";

type ForgotPasswordBody = {
  email?: string;
};

function recoveryCallbackUrl(siteUrl: string, tokenHash: string) {
  const base = siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "recovery",
    next: "/auth/update-password",
  });
  return `${base}/auth/callback?${params.toString()}`;
}

async function sendRecoveryEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "GotREFS <onboarding@resend.dev>";
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your GotREFS password",
      html: `
        <h2>Reset your password</h2>
        <p>We received a request to set or reset your GotREFS password.</p>
        <p><a href="${resetUrl}">Set your password</a></p>
        <p>This link works on any device and expires shortly. If you didn’t ask for this, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[forgot-password] Resend failed:", res.status, text);
    return false;
  }
  return true;
}

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

  const siteUrl = resolveSiteUrlFromRequest(request);
  const genericOk = {
    ok: true,
    message:
      "If an account exists for that email, we sent a link to set or reset your password. Open the newest email and use “Set your password”.",
  };

  // Prefer token_hash links (work from mail apps). Requires service role + Resend.
  try {
    const admin = createServiceClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl.replace(/\/$/, "")}/auth/update-password`,
      },
    });

    if (!error) {
      const tokenHash = data.properties?.hashed_token;
      if (tokenHash) {
        const resetUrl = recoveryCallbackUrl(siteUrl, tokenHash);
        const sent = await sendRecoveryEmail(email, resetUrl);
        if (sent) {
          return NextResponse.json(genericOk);
        }
        console.warn(
          "[forgot-password] Generated token_hash link but Resend is not configured/failed; falling back to Supabase email."
        );
      }
    } else {
      // Unknown email — still return generic success (no account enumeration).
      const msg = error.message.toLowerCase();
      if (msg.includes("user not found") || msg.includes("unable to find")) {
        return NextResponse.json(genericOk);
      }
      console.error("[forgot-password] generateLink:", error.message);
    }
  } catch (err) {
    console.error("[forgot-password] generateLink unavailable:", err);
  }

  // Fallback: Supabase Auth email (requires Reset password template to use token_hash — see EMAIL_AUTH_TEMPLATES.md)
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
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

  return jsonWithSessionCookies(sessionResponse, genericOk);
}
