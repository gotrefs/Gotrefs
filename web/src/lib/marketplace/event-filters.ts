import type { AppliedBoost } from "@/lib/boosts";
import { payBounds, payRangesOverlap, type PayRangeInput } from "@/lib/pay-range";

export type OpenEventRecord = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  city: string | null;
  state: string | null;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
  notes: string | null;
  booked_count?: number;
  boosts?: string[] | null;
  /** Boosts that currently apply for the ref viewing this event. */
  active_boosts?: AppliedBoost[];
};

export type RefProfileForMatch = {
  primary_sport?: string | null;
  additional_sports?: string[] | null;
  rate_type?: string | null;
  rate_min?: number | null;
  rate_max?: number | null;
  rate_per_game?: number | null;
  rate_unit?: string | null;
  home_zip?: string | null;
  travel_radius_miles?: number | null;
};

export function eventPayInput(event: {
  pay_type?: string | null;
  pay_offer?: number | null;
  pay_min?: number | null;
  pay_max?: number | null;
}): PayRangeInput {
  return {
    type: event.pay_type === "range" ? "range" : "exact",
    exact: event.pay_offer,
    min: event.pay_min,
    max: event.pay_max,
  };
}

export function refPayInput(profile: RefProfileForMatch): PayRangeInput {
  return {
    type: profile.rate_type === "range" ? "range" : "exact",
    exact: profile.rate_per_game ?? profile.rate_min,
    min: profile.rate_min,
    max: profile.rate_max,
  };
}

export function refOfficiatesSport(profile: RefProfileForMatch, sport: string): boolean {
  const normalized = sport.trim().toLowerCase();
  if (!normalized) return true;
  const primary = (profile.primary_sport ?? "").trim().toLowerCase();
  if (primary === normalized) return true;
  const extras = Array.isArray(profile.additional_sports) ? profile.additional_sports : [];
  return extras.some((item) => item.trim().toLowerCase() === normalized);
}

/** True when the ref has configured at least one sport to match against. */
export function refHasSportsConfigured(profile: RefProfileForMatch | null | undefined): boolean {
  if (!profile) return false;
  if ((profile.primary_sport ?? "").trim()) return true;
  const extras = Array.isArray(profile.additional_sports) ? profile.additional_sports : [];
  return extras.some((item) => Boolean(item?.trim()));
}

export type OpenEventFilters = {
  sport?: string | null;
  zip?: string | null;
  startsAfter?: string | null;
  startsBefore?: string | null;
  payMatchesRef?: boolean;
  refProfile?: RefProfileForMatch | null;
};

export function filterOpenEvents(events: OpenEventRecord[], filters: OpenEventFilters): OpenEventRecord[] {
  const sport = filters.sport?.trim();
  const zip = filters.zip?.trim();
  const startsAfter = filters.startsAfter ? new Date(filters.startsAfter) : null;
  const startsBefore = filters.startsBefore ? new Date(filters.startsBefore) : null;
  const refProfile = filters.refProfile;
  const matchRefSports = refHasSportsConfigured(refProfile);

  return events.filter((event) => {
    const start = new Date(event.starts_at);
    if (startsAfter && !Number.isNaN(startsAfter.getTime()) && start < startsAfter) return false;
    if (startsBefore && !Number.isNaN(startsBefore.getTime()) && start > startsBefore) return false;
    if (sport && event.sport.trim().toLowerCase() !== sport.toLowerCase()) return false;
    if (zip && event.zip_code.trim() !== zip) return false;
    // Only apply profile sport matching when the ref has sports configured.
    if (matchRefSports && refProfile && !refOfficiatesSport(refProfile, event.sport)) return false;
    if (filters.payMatchesRef && refProfile) {
      if (!payRangesOverlap(refPayInput(refProfile), eventPayInput(event))) return false;
    }
    const booked = event.booked_count ?? 0;
    if (booked >= event.officials_needed) return false;
    return true;
  });
}

export function payMatchLabel(
  refProfile: RefProfileForMatch | null | undefined,
  event: OpenEventRecord
): string | null {
  if (!refProfile) return null;
  if (!payRangesOverlap(refPayInput(refProfile), eventPayInput(event))) return "Pay outside your rate";
  const refBounds = payBounds(refPayInput(refProfile));
  const eventBounds = payBounds(eventPayInput(event));
  if (refBounds.min == null || eventBounds.min == null) return null;
  return "Pay matches your rate";
}
