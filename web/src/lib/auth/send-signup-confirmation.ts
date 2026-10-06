import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  safeSignupRedirectPath,
  type SignupDashboardPath,
} from "@/lib/auth/email-confirmation";
import { BRAND_NAME } from "@/lib/brand";
import { emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/resend";

/**
 * The confirmation email itself. A complete HTML document plus a full plain-text
 * version (not just a bare link): mail filters treat link-only messages as suspect.
 */
export function buildSignupConfirmationEmail(confirmUrl: string) {
  return {
    subject: `Confirm your ${BRAND_NAME} email`,
    html: emailLayout({
      title: "Confirm your email",
      bodyHtml: `
        <p style="margin:0 0 12px;">Thanks for joining ${BRAND_NAME}. Confirm your email to open your account. The link works on your phone or your computer.</p>
        <p style="margin:0;font-size:13px;color:#7B8FA0;">If the button doesn’t work, copy this link into your browser:<br/><span style="word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(confirmUrl)}</span></p>
        <p style="margin:12px 0 0;font-size:13px;color:#7B8FA0;">If you didn’t sign up for ${BRAND_NAME}, you can ignore this email.</p>`,
      ctaLabel: "Confirm email",
      ctaUrl: confirmUrl,
      ctaLarge: true,
    }),
    text: [
      `Thanks for joining ${BRAND_NAME}.`,
      "",
      "Confirm your email to open your account:",
      confirmUrl,
      "",
      "The link works on your phone or your computer.",
      `If you didn't sign up for ${BRAND_NAME}, you can ignore this email.`,
    ].join("\n"),
  };
}

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
  const sent = await sendEmail({ to: email, ...buildSignupConfirmationEmail(confirmUrl) });

  if (!sent) {
    return {
      sent: false,
      error: "Could not send confirmation email (check RESEND_API_KEY).",
    };
  }

  return { sent: true };
}
