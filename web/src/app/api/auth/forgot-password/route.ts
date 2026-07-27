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

function isCooldownError(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("for security purposes") ||
    msg.includes("only request this after") ||
    msg.includes("only request this once")
  );
}

async function sendRecoveryEmail(to: string, resetUrl: string) {
  const apiKey = serverEnv.resendApiKey();
  const from =
    serverEnv.resendFromEmail() || "GotRefs <onboarding@resend.dev>";
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
      subject: "Reset your GotRefs password",
      html: `
        <h2>Reset your password</h2>
        <p>We received a request to set or reset your GotRefs password.</p>
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

async function clearRecoveryCooldown(
  admin: ReturnType<typeof createServiceClient>,
  email: string
) {
  const { error } = await admin.rpc("clear_auth_recovery_cooldown", {
    target_email: email,
  });
  if (error) {
    console.warn("[forgot-password] clear_auth_recovery_cooldown:", error.message);
  }
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

  const resendConfigured = Boolean(serverEnv.resendApiKey());

  // Prefer token_hash links via admin generateLink + Resend (no 60s Auth cooldown).
  // Never call resetPasswordForEmail after a successful generateLink — that updates
  // recovery_sent_at and immediately triggers Supabase's "after N seconds" error.
  if (resendConfigured) {
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
            "[forgot-password] generateLink succeeded but Resend failed; not falling through to /recover."
          );
          return NextResponse.json(
            { error: "Could not send the password reset email. Please try again." },
            { status: 502 }
          );
        }
      } else {
        const msg = error.message.toLowerCase();
        if (msg.includes("user not found") || msg.includes("unable to find")) {
          return NextResponse.json(genericOk);
        }
        console.error("[forgot-password] generateLink:", error.message);
      }
    } catch (err) {
      console.error("[forgot-password] generateLink unavailable:", err);
    }
  }

  // Fallback: Supabase Auth email (requires Reset password template — see EMAIL_AUTH_TEMPLATES.md)
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);

  try {
    const admin = createServiceClient();
    await clearRecoveryCooldown(admin, email);
  } catch (err) {
    console.warn("[forgot-password] could not clear recovery cooldown:", err);
  }

  let { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error && isCooldownError(error.message)) {
    try {
      const admin = createServiceClient();
      await clearRecoveryCooldown(admin, email);
      ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo }));
    } catch (err) {
      console.warn("[forgot-password] cooldown retry failed:", err);
    }
  }

  if (error) {
    if (isCooldownError(error.message)) {
      // Migration not applied yet, or Auth still blocking — never show the 59s copy.
      return NextResponse.json(
        { error: "Could not send the password reset email. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return jsonWithSessionCookies(sessionResponse, genericOk);
}
