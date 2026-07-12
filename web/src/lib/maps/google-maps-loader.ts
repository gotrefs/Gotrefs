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

async function importMapsLibraries(): Promise<typeof google> {
  if (!window.google?.maps?.importLibrary) {
    throw new Error("Google Maps importLibrary is unavailable.");
  }
  await window.google.maps.importLibrary("maps");
  const places = (await window.google.maps.importLibrary("places")) as GooglePlacesLib;
  if (!places?.AutocompleteSuggestion || !places?.AutocompleteSessionToken) {
    throw new Error("Places library loaded without AutocompleteSuggestion.");
  }
  window.__gotrefsPlacesLib = places;
  return window.google;
}

/** Places library exports from importLibrary("places"). */
export async function loadGooglePlaces(): Promise<GooglePlacesLib> {
  await loadGoogleMaps();
  if (window.__gotrefsPlacesLib?.AutocompleteSuggestion) {
    return window.__gotrefsPlacesLib;
  }
  const places = (await google.maps.importLibrary("places")) as GooglePlacesLib;
  window.__gotrefsPlacesLib = places;
  return places;
}

/** Load Maps JS + Places once via importLibrary (required with loading=async). */
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

  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set."));
  }

  window.__gotrefsGoogleMapsPromise = new Promise((resolve, reject) => {
    const fail = (message: string) => {
      window.__gotrefsGoogleMapsPromise = undefined;
      reject(new Error(message));
    };

    window.gm_authFailure = () => {
      fail(mapsAuthErrorMessage());
    };

    const finish = () => {
      void importMapsLibraries()
        .then(resolve)
        .catch((err) => {
          fail(err instanceof Error ? err.message : mapsAuthErrorMessage());
        });
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-gotrefs-google-maps]");
    if (existing) {
      if (typeof window.google?.maps?.importLibrary === "function") {
        finish();
        return;
      }
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => fail("Google Maps failed to load."));
      return;
    }

    const script = document.createElement("script");
    script.dataset.gotrefsGoogleMaps = "1";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.onload = finish;
    script.onerror = () => fail("Google Maps failed to load.");
    document.head.appendChild(script);
  });

  return window.__gotrefsGoogleMapsPromise;
}
