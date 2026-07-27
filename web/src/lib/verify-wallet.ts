import { loadPublicRefIdCard, normalizeGotrefsId, type PublicRefIdCard } from "@/lib/public-ref-id-card";

export function splitAcceptedOrgs(card: PublicRefIdCard): string[] {
  const raw = card.certifiedBy?.trim() || card.certificationLevel?.trim() || "";
  if (!raw) return [];
  return raw
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function sportsList(card: PublicRefIdCard): string[] {
  return [card.primarySport, ...(card.additionalSports ?? [])]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
}

export function cityLabel(card: PublicRefIdCard): string {
  return (
    card.baseCity?.trim() ||
    (card.workRegions ?? []).filter(Boolean).slice(0, 2).join(", ") ||
    "Not listed"
  );
}

export async function loadVerifyCard(rawId: string) {
  const id = normalizeGotrefsId(rawId || "");
  if (!id || id.length < 4) return null;
  return loadPublicRefIdCard(id);
}

export function verifyPageUrl(gotrefsId: string): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const origin =
    env && !/localhost|127\.0\.0\.1/i.test(env)
      ? env
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`
        : "https://gotrefs.org";
  return `${origin}/verify/${encodeURIComponent(gotrefsId.trim())}`;
}

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    process.env.APPLE_PASS_CERT_PEM?.trim() &&
      process.env.APPLE_PASS_KEY_PEM?.trim() &&
      process.env.APPLE_PASS_WWDR_PEM?.trim() &&
      process.env.APPLE_PASS_TYPE_IDENTIFIER?.trim() &&
      process.env.APPLE_TEAM_ID?.trim()
  );
}

export function isGoogleWalletConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_WALLET_ISSUER_ID?.trim() &&
      process.env.GOOGLE_WALLET_SA_EMAIL?.trim() &&
      process.env.GOOGLE_WALLET_SA_PRIVATE_KEY?.trim()
  );
}
