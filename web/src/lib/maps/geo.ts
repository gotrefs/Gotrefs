const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance in miles between two WGS84 points. */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Default browse radius when a Where place is selected. */
export const DEFAULT_SEARCH_RADIUS_MILES = 40;

/**
 * Privacy radius for open-game browse pins.
 * Pin is jittered within this radius; circle matches preview copy (~7 mi area).
 * Exact venue stays hidden until the organizer confirms the ref.
 */
export const EVENT_PRIVACY_RADIUS_MILES = 7;
export const EVENT_PRIVACY_RADIUS_METERS = EVENT_PRIVACY_RADIUS_MILES * 1609.344;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic jittered point within `radiusMiles` of the true/ZIP coords.
 * Uniform-in-disk sampling so the pin is not the exact venue, but stable across renders.
 */
export function approximateEventCoords(
  coords: { lat: number; lng: number },
  seed: string,
  radiusMiles = EVENT_PRIVACY_RADIUS_MILES
): { lat: number; lng: number } {
  const h1 = hashSeed(seed);
  const h2 = hashSeed(`${seed}:r`);
  const angle = (h1 / 0xffffffff) * 2 * Math.PI;
  // sqrt for uniform distribution over disk area
  const offsetMiles = radiusMiles * Math.sqrt(h2 / 0xffffffff);
  const latOffset = (offsetMiles / 69) * Math.cos(angle);
  const cosLat = Math.cos((coords.lat * Math.PI) / 180) || 0.01;
  const lngOffset = (offsetMiles / (69 * cosLat)) * Math.sin(angle);
  return {
    lat: coords.lat + latOffset,
    lng: coords.lng + lngOffset,
  };
}
