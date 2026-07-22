/** GotREFS marketplace service fee charged to organizers on accepted ref pay. */
export const PLATFORM_FEE_RATE = 0.2;

export const PLATFORM_FEE_PERCENT_LABEL = "20%";

export function platformFeeCents(refSubtotalCents: number) {
  if (!Number.isFinite(refSubtotalCents) || refSubtotalCents <= 0) return 0;
  return Math.round(refSubtotalCents * PLATFORM_FEE_RATE);
}
