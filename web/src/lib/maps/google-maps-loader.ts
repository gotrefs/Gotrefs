import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

/** Browser Google Maps API key (Maps JavaScript + Places). */
export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

export type GooglePlacesLib = google.maps.PlacesLibrary;

declare global {
  interface Window {
    google?: typeof google;
    __gotrefsGoogleMapsPromise?: Promise<typeof google>;
    __gotrefsPlacesLib?: GooglePlacesLib;
    gm_authFailure?: () => void;
  }
}

function mapsAuthErrorMessage() {
  return (
    "Google Maps rejected this API key. Confirm billing is linked to the GotREFS project, " +
    "APIs are enabled, and HTTP referrers include this exact site."
  );
}

async function bootstrapGoogleMaps(): Promise<typeof google> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.");
  }

  setOptions({ key, v: "weekly" });

  await new Promise<void>((resolve, reject) => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      previous?.();
      reject(new Error(mapsAuthErrorMessage()));
    };
    void importLibrary("maps")
      .then(async () => {
        const places = await importLibrary("places");
        if (!places.AutocompleteSuggestion || !places.AutocompleteSessionToken) {
          throw new Error("Places Autocomplete (New) is unavailable on this key/project.");
        }
        window.__gotrefsPlacesLib = places;
        resolve();
      })
      .catch((err) => {
        reject(err instanceof Error ? err : new Error(mapsAuthErrorMessage()));
      });
  });

  if (!window.google?.maps) {
    throw new Error("Google Maps failed to initialize.");
  }
  return window.google;
}

/** Places library exports from importLibrary("places"). */
export async function loadGooglePlaces(): Promise<GooglePlacesLib> {
  await loadGoogleMaps();
  if (window.__gotrefsPlacesLib?.AutocompleteSuggestion) {
    return window.__gotrefsPlacesLib;
  }
  const places = await importLibrary("places");
  window.__gotrefsPlacesLib = places;
  return places;
}

/** Load Maps JS + Places once via the official @googlemaps/js-api-loader. */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (window.__gotrefsPlacesLib?.AutocompleteSuggestion && window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (window.__gotrefsGoogleMapsPromise) {
    return window.__gotrefsGoogleMapsPromise;
  }

  window.__gotrefsGoogleMapsPromise = bootstrapGoogleMaps().catch((err) => {
    window.__gotrefsGoogleMapsPromise = undefined;
    throw err instanceof Error ? err : new Error(mapsAuthErrorMessage());
  });

  return window.__gotrefsGoogleMapsPromise;
}
