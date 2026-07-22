import { distanceMiles, DEFAULT_SEARCH_RADIUS_MILES } from "@/lib/maps/geo";
import { geocodeUsZip, geocodeZipBatch } from "@/lib/marketplace/zip-geocode";
import { refOfficiatesSport } from "@/lib/marketplace/event-filters";
import { payRangesOverlap } from "@/lib/pay-range";

export type MatchEventInput = {
  id: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  pay_offer: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
};

export type MatchRefInput = {
  id: string;
  primarySport: string;
  additionalSports?: string[];
  homeZip: string | null;
  travelRadiusMiles?: number | null;
  availability: { start_at: string; end_at: string }[];
  rateType?: string | null;
  rateMin?: number | null;
  rateMax?: number | null;
  ratePerGame?: number | null;
};

export type MatchedRef<T extends MatchRefInput> = T & {
  distanceMiles: number;
  coords: { lat: number; lng: number };
  travelRadiusMiles: number;
};

function slotCoversEvent(
  slot: { start_at: string; end_at: string },
  event: Pick<MatchEventInput, "starts_at" | "ends_at">
) {
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  const slotStart = new Date(slot.start_at).getTime();
  const slotEnd = new Date(slot.end_at).getTime();
  return slotStart <= start && slotEnd >= end;
}

function eventPayInput(event: MatchEventInput) {
  return {
    type: event.pay_type === "range" ? ("range" as const) : ("exact" as const),
    exact: event.pay_offer,
    min: event.pay_min,
    max: event.pay_max,
  };
}

function refPayInput(ref: MatchRefInput) {
  return {
    type: ref.rateType === "range" ? ("range" as const) : ("exact" as const),
    exact: ref.ratePerGame ?? ref.rateMin,
    min: ref.rateMin,
    max: ref.rateMax,
  };
}

export async function resolveEventCoords(
  event: Pick<MatchEventInput, "venue_lat" | "venue_lng" | "zip_code">
): Promise<{ lat: number; lng: number } | null> {
  if (
    typeof event.venue_lat === "number" &&
    Number.isFinite(event.venue_lat) &&
    typeof event.venue_lng === "number" &&
    Number.isFinite(event.venue_lng)
  ) {
    return { lat: event.venue_lat, lng: event.venue_lng };
  }
  const zip = await geocodeUsZip(event.zip_code);
  return zip ? { lat: zip.lat, lng: zip.lng } : null;
}

/** Match verified refs whose travel radius overlaps the event and sport/pay/availability fit. */
export async function matchRefsForEvent<T extends MatchRefInput>(
  event: MatchEventInput,
  refs: T[],
  opts?: { excludeIds?: Set<string>; requireAvailability?: boolean }
): Promise<{ eventCoords: { lat: number; lng: number } | null; matches: MatchedRef<T>[] }> {
  const eventCoords = await resolveEventCoords(event);
  if (!eventCoords) {
    return { eventCoords: null, matches: [] };
  }

  const zipCoords = await geocodeZipBatch(
    refs.map((ref) => ref.homeZip).filter((zip): zip is string => Boolean(zip))
  );

  const requireAvailability = opts?.requireAvailability !== false;
  const excludeIds = opts?.excludeIds ?? new Set<string>();
  const matches: MatchedRef<T>[] = [];

  for (const ref of refs) {
    if (excludeIds.has(ref.id)) continue;
    if (
      !refOfficiatesSport(
        {
          primary_sport: ref.primarySport,
          additional_sports: ref.additionalSports ?? [],
        },
        event.sport
      )
    ) {
      continue;
    }
    if (!payRangesOverlap(refPayInput(ref), eventPayInput(event))) continue;
    if (requireAvailability && ref.availability.length > 0) {
      const available = ref.availability.some((slot) => slotCoversEvent(slot, event));
      if (!available) continue;
    }

    const zip = ref.homeZip?.trim().slice(0, 5) ?? "";
    const coords = zipCoords.get(zip);
    if (!coords) continue;

    const miles = distanceMiles(eventCoords, coords);
    const travelRadius = Number(ref.travelRadiusMiles);
    const radius =
      Number.isFinite(travelRadius) && travelRadius > 0 ? travelRadius : DEFAULT_SEARCH_RADIUS_MILES;
    if (miles > radius) continue;

    matches.push({
      ...ref,
      distanceMiles: miles,
      coords: { lat: coords.lat, lng: coords.lng },
      travelRadiusMiles: radius,
    });
  }

  matches.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return { eventCoords, matches };
}

export function formatFirstLastInitial(displayName: string | null | undefined) {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Official";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}
