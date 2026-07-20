/**
 * Event pay boosts. Organizers select boosts when publishing an event; when an
 * offer is created for a ref, the applicable boosts raise the offered pay, and
 * the organizer pays the boosted amount at checkout (offered_pay drives both).
 */

export type BoostId = "new_listing" | "last_minute" | "multi_game" | "season";

export type BoostDefinition = {
  id: BoostId;
  percent: number;
  title: string;
  subtitle: string;
};

export const EVENT_BOOSTS: readonly BoostDefinition[] = [
  {
    id: "new_listing",
    percent: 20,
    title: "New event promotion",
    subtitle: "Offer 20% more pay to your first 10 refs booked",
  },
  {
    id: "last_minute",
    percent: 11,
    title: "Last-minute boost",
    subtitle: "Extra pay for refs who accept 14 days or less before the game",
  },
  {
    id: "multi_game",
    percent: 10,
    title: "Multi-game bonus",
    subtitle: "For refs working 3 or more of your games",
  },
  {
    id: "season",
    percent: 15,
    title: "Season commitment",
    subtitle: "For refs who commit to your full season",
  },
] as const;

export const NEW_LISTING_BOOKING_LIMIT = 10;
export const LAST_MINUTE_WINDOW_DAYS = 14;
/** A ref qualifies for the multi-game bonus starting with their 3rd game for the same organizer. */
export const MULTI_GAME_MIN_PRIOR_BOOKINGS = 2;

export type AppliedBoost = { id: BoostId; percent: number; title: string };

export function boostDefinition(id: string): BoostDefinition | undefined {
  return EVENT_BOOSTS.find((boost) => boost.id === id);
}

export function sanitizeBoostIds(input: unknown): BoostId[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<BoostId>();
  for (const value of input) {
    if (typeof value === "string" && boostDefinition(value)) seen.add(value as BoostId);
  }
  return Array.from(seen);
}

/**
 * Decide which of the event's selected boosts apply to a specific offer.
 * The "season" boost needs a manual season commitment, so it is never
 * auto-applied here.
 */
export function computeAppliedBoosts(params: {
  eventBoosts: string[] | null | undefined;
  eventStartsAt: string | null | undefined;
  /** Accepted bookings across all of this organizer's events. */
  organizerAcceptedCount: number;
  /** Accepted bookings this ref already has with this organizer. */
  refAcceptedWithOrganizerCount: number;
  now?: Date;
}): AppliedBoost[] {
  const now = params.now ?? new Date();
  const applied: AppliedBoost[] = [];
  for (const id of sanitizeBoostIds(params.eventBoosts)) {
    const def = boostDefinition(id);
    if (!def) continue;
    let qualifies = false;
    if (id === "new_listing") {
      qualifies = params.organizerAcceptedCount < NEW_LISTING_BOOKING_LIMIT;
    } else if (id === "last_minute") {
      const start = params.eventStartsAt ? new Date(params.eventStartsAt).getTime() : NaN;
      const msUntilStart = start - now.getTime();
      qualifies =
        Number.isFinite(start) &&
        msUntilStart > 0 &&
        msUntilStart <= LAST_MINUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    } else if (id === "multi_game") {
      qualifies = params.refAcceptedWithOrganizerCount >= MULTI_GAME_MIN_PRIOR_BOOKINGS;
    }
    if (qualifies) applied.push({ id: def.id, percent: def.percent, title: def.title });
  }
  return applied;
}

export function totalBoostPercent(applied: readonly AppliedBoost[]): number {
  return applied.reduce((sum, boost) => sum + boost.percent, 0);
}

/** Boosted pay in dollars, rounded to cents. */
export function applyBoostToPay(basePay: number, percent: number): number {
  return Math.round(basePay * (100 + percent)) / 100;
}
