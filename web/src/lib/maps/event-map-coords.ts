import { approximateEventCoords } from "@/lib/maps/geo";

/** Jittered map pin from the true venue coords — safe to show refs before booking. */
export function publicMapCoordsFromVenue(
  eventId: string,
  venueLat: number | null | undefined,
  venueLng: number | null | undefined
): { lat: number; lng: number } | null {
  if (
    typeof venueLat !== "number" ||
    typeof venueLng !== "number" ||
    !Number.isFinite(venueLat) ||
    !Number.isFinite(venueLng)
  ) {
    return null;
  }
  return approximateEventCoords({ lat: venueLat, lng: venueLng }, eventId);
}
