/**
 * Base URL used in QR codes / share links that must open on a phone.
 * Never use localhost here — phone cameras cannot reach your laptop.
 */
export function resolvePublicCardOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env && !/localhost|127\.0\.0\.1/i.test(env)) {
    return env;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) {
      return origin;
    }
  }

  return "https://gotrefs.org";
}

/** HTML card page (fallback). */
export function publicRefIdCardUrl(gotrefsId: string): string {
  const id = gotrefsId.trim();
  return `${resolvePublicCardOrigin()}/id/${encodeURIComponent(id)}`;
}

/**
 * Direct PDF URL for organizer QR scans.
 * Opens instantly in the phone's PDF viewer — no dashboard, no extra taps.
 */
export function publicRefIdCardPdfUrl(gotrefsId: string): string {
  const id = gotrefsId.trim();
  return `${resolvePublicCardOrigin()}/api/id/${encodeURIComponent(id)}/pdf`;
}
