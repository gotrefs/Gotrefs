import { platformFeeCents as calcPlatformFeeCents } from "@/lib/platform-fee";

export type ConfirmPayOfferLine = {
  offerId: string;
  refMemberId: string;
  rateCents: number;
  gamesCount: number;
  refSubtotalCents: number;
};

export type ConfirmPayBreakdown = {
  offers: ConfirmPayOfferLine[];
  refCount: number;
  refSubtotalCents: number;
  platformFeeCents: number;
  /** No longer charged (always 0). Kept so older screens and emails still read. */
  depositCents: number;
  depositAlreadyHeldCents: number;
  depositRequiredAfterCents: number;
  totalCents: number;
};

/** Deposit for N refs = sum of one game at each ref's rate (no fee). */
export function depositForRefsCents(ratesCents: number[]) {
  return ratesCents.reduce((sum, rate) => sum + Math.max(0, Math.round(rate)), 0);
}

/**
 * Build confirm-pay totals: REF pay for the booked games/hours + the 20% GotREFS fee on that pay.
 * No deposit: extra work is charged after the event, once the REF signs off on the timesheet.
 */
export function buildConfirmPayBreakdown(args: {
  offers: ConfirmPayOfferLine[];
  depositCollectedCents: number;
  depositRequiredCents: number;
}): ConfirmPayBreakdown {
  const offers = args.offers.filter((o) => o.refSubtotalCents > 0);
  const refSubtotalCents = offers.reduce((sum, o) => sum + o.refSubtotalCents, 0);
  const platformFeeCents = calcPlatformFeeCents(refSubtotalCents);
  const depositRequiredAfterCents = Math.max(0, args.depositRequiredCents);
  const depositCents = 0;
  const totalCents = refSubtotalCents + platformFeeCents;

  return {
    offers,
    refCount: offers.length,
    refSubtotalCents,
    platformFeeCents,
    depositCents,
    depositAlreadyHeldCents: Math.max(0, args.depositCollectedCents),
    depositRequiredAfterCents,
    totalCents,
  };
}
