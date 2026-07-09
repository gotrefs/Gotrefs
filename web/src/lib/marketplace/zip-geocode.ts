export type ZipCoordinates = {
  lat: number;
  lng: number;
  place: string;
};

const cache = new Map<string, ZipCoordinates | null>();

/** Free US ZIP lookup (no API key). Results are cached in memory. */
export async function geocodeUsZip(zip: string): Promise<ZipCoordinates | null> {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${normalized}`);
    if (!res.ok) {
      cache.set(normalized, null);
      return null;
    }
    const json = (await res.json()) as {
      places?: { latitude: string; longitude: string; "place name"?: string; "state abbreviation"?: string }[];
    };
    const place = json.places?.[0];
    if (!place) {
      cache.set(normalized, null);
      return null;
    }
    const result: ZipCoordinates = {
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      place: [place["place name"], place["state abbreviation"]].filter(Boolean).join(", "),
    };
    cache.set(normalized, result);
    return result;
  } catch {
    cache.set(normalized, null);
    return null;
  }
}

export async function geocodeZipBatch(zips: string[]): Promise<Map<string, ZipCoordinates>> {
  const unique = Array.from(new Set(zips.map((z) => z.trim().slice(0, 5)).filter((z) => /^\d{5}$/.test(z))));
  const results = await Promise.all(unique.map(async (zip) => [zip, await geocodeUsZip(zip)] as const));
  const map = new Map<string, ZipCoordinates>();
  for (const [zip, coords] of results) {
    if (coords) map.set(zip, coords);
  }
  return map;
}
