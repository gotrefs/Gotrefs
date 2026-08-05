import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  safeSignupRedirectPath,
  type SignupDashboardPath,
} from "@/lib/auth/email-confirmation";
import { BRAND_NAME } from "@/lib/brand";
import { sendEmail } from "@/lib/email/resend";

/** Cross-device confirmation link (token_hash). PKCE `code=` links break when opened on another device. */
export function buildSignupConfirmationCallbackUrl(
  siteUrl: string,
  tokenHash: string,
  nextPath: SignupDashboardPath
) {
  const base = siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: "magiclink",
    next: nextPath,
  });
  return `${base}/auth/callback?${params.toString()}`;
}

/**
 * Send a confirmation email that works on any device (phone or computer).
 * Uses admin generateLink + Resend so we are not stuck with Supabase's PKCE `code=` Confirm URL.
 */
export async function sendCrossDeviceSignupConfirmationEmail(options: {
  admin: SupabaseClient;
  email: string;
  siteUrl: string;
  pendingRedirect?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const email = options.email.trim().toLowerCase();
  const nextPath = safeSignupRedirectPath(options.pendingRedirect);

  const { data, error } = await options.admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${options.siteUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    console.error("[signup-confirm] generateLink:", error.message);
    return { sent: false, error: error.message };
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    return { sent: false, error: "No confirmation token returned." };
  }

  const confirmUrl = buildSignupConfirmationCallbackUrl(options.siteUrl, tokenHash, nextPath);
  const sent = await sendEmail({
    to: email,
    subject: `Confirm your ${BRAND_NAME} email`,
    html: `
      <h2>Confirm your email</h2>
      <p>Thanks for joining ${BRAND_NAME}. Tap the button below to confirm your email — this works on your phone or computer.</p>
      <p><a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;background:#221e3f;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Confirm email &amp; continue</a></p>
      <p style="color:#666;font-size:14px;">If the button does not work, copy and paste this link into your browser:<br/>${confirmUrl}</p>
      <p style="color:#666;font-size:14px;">After you confirm, return to the browser where you signed up — it will open your dashboard automatically. You can also open the link on this device.</p>
    `,
    text: `Confirm your ${BRAND_NAME} email: ${confirmUrl}`,
  });

  if (!sent) {
    return {
      sent: false,
      error: "Could not send confirmation email (check RESEND_API_KEY).",
    };
  }

  return { sent: true };
}
