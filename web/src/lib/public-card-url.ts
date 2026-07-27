/**
 * Base URL used in QR codes / share links that must open on a phone.
 */
export function resolvePublicCardOrigin(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (origin && !isLoopbackHost(origin)) {
      return origin;
    }
  }

  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env && !isLoopbackHost(env)) {
    return env;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    if (origin) return origin;
  }

  return "https://gotrefs.org";
}

function isLoopbackHost(urlOrOrigin: string): boolean {
  try {
    const host = urlOrOrigin.includes("://")
      ? new URL(urlOrOrigin).hostname
      : urlOrOrigin.replace(/^https?:\/\//i, "").split("/")[0]?.split(":")[0] || "";
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(urlOrOrigin);
  }
}

/** QR scan target — public verified-official page (no login). */
export function publicRefIdCardUrl(gotrefsId: string): string {
  const id = gotrefsId.trim();
  return `${resolvePublicCardOrigin()}/verify/${encodeURIComponent(id)}`;
}

export function publicRefIdCardImageUrl(gotrefsId: string): string {
  return publicRefIdCardUrl(gotrefsId);
}

export function publicRefIdCardPdfUrl(gotrefsId: string): string {
  const id = gotrefsId.trim();
  return `${resolvePublicCardOrigin()}/api/id/${encodeURIComponent(id)}/pdf`;
}
