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
  /** One extra game at each ref's rate for refs in this payment (top-up only). */
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
 * Build confirm-pay totals: ref pay + 20% fee on ref pay only + deposit top-up
 * (1 extra game × each unpaid accepted ref being paid now).
 */
export function buildConfirmPayBreakdown(args: {
  offers: ConfirmPayOfferLine[];
  depositCollectedCents: number;
  depositRequiredCents: number;
}): ConfirmPayBreakdown {
  const offers = args.offers.filter((o) => o.refSubtotalCents > 0);
  const refSubtotalCents = offers.reduce((sum, o) => sum + o.refSubtotalCents, 0);
  const platformFeeCents = calcPlatformFeeCents(refSubtotalCents);
  const ratesForDeposit = offers.map((o) => o.rateCents);
  const depositForThisBatch = depositForRefsCents(ratesForDeposit);
  const depositRequiredAfterCents = args.depositRequiredCents + depositForThisBatch;
  const depositCents = Math.max(0, depositRequiredAfterCents - Math.max(0, args.depositCollectedCents));
  const totalCents = refSubtotalCents + platformFeeCents + depositCents;

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
