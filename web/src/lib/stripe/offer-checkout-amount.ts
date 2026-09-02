import "server-only";

import { dollarsToCents } from "@/lib/stripe/client";

/**
 * Resolve the per-game rate (cents) for an accepted offer at checkout / payout.
 * Prefer the agreed offer amount, then the ref’s custom profile rate, then event pay.
 */
export function resolveOfferRateCents(args: {
  offeredPay?: number | string | null;
  refRatePerGame?: number | string | null;
  eventPayOffer?: number | string | null;
}) {
  return (
    dollarsToCents(args.offeredPay) ||
    dollarsToCents(args.refRatePerGame) ||
    dollarsToCents(args.eventPayOffer) ||
    0
  );
}

/**
 * Games in this assignment. Prefer organizer-set games_count on the offer.
 */
export function resolveOfferGamesWorked(
  offer?: { games_count?: number | null; games_worked?: number | null } | null
) {
  const raw = offer?.games_count ?? offer?.games_worked;
  if (raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return Math.max(1, Math.round(Number(raw)));
  }
  return 1;
}

/** Clamp organizer-provided games_count for create/update APIs. */
export function normalizeGamesCount(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return Math.max(1, Math.round(fallback));
  return Math.min(99, Math.round(n));
}
