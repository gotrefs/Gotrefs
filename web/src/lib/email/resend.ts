import "server-only";
import { BRAND_NAME } from "@/lib/brand";
import { resolveSiteUrl, serverEnv } from "@/lib/env/server";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/** Send via Resend. Returns false if not configured or the API call fails (never throws). */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = serverEnv.resendApiKey();
  const from =
    serverEnv.resendFromEmail() || `${BRAND_NAME} <onboarding@resend.dev>`;
  const to = input.to.trim().toLowerCase();
  if (!apiKey || !to.includes("@")) {
    if (!apiKey) {
      console.warn("[email] RESEND_API_KEY not set — skipped:", input.subject);
    }
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend failed:", res.status, body);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Resend error:", error);
    return false;
  }
}

/** Public site URL for email CTAs (prefer production domain). */
export function emailSiteUrl(requestUrl?: string | null): string {
  let requestOrigin: string | null = null;
  if (requestUrl) {
    try {
      requestOrigin = new URL(requestUrl).origin;
    } catch {
      // ignore
    }
  }

  const resolved = resolveSiteUrl(requestOrigin);
  if (!resolved.includes("localhost")) return resolved;

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return "https://gotrefs.org";
  }

  return resolved;
}
