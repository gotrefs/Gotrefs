import { BRAND_NAME } from "@/lib/brand";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/** Send via Resend. Returns false if not configured or the API call fails (never throws). */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || `${BRAND_NAME} <onboarding@resend.dev>`;
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
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) return configured;

  if (requestUrl) {
    try {
      const origin = new URL(requestUrl).origin.replace(/\/$/, "");
      if (origin && !origin.includes("localhost")) return origin;
    } catch {
      // ignore
    }
  }

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return "https://gotrefs.org";
  }

  return configured || "http://localhost:3000";
}
