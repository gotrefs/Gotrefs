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
    __gotrefsInitMaps?: () => void;
    gm_authFailure?: () => void;
  }
}

function mapsAuthErrorMessage() {
  return (
    "Google Maps rejected this API key. Confirm billing is linked to the GotREFS project, " +
    "APIs are enabled, and HTTP referrers include this exact site."
  );
}

async function loadLibraries(): Promise<typeof google> {
  if (!window.google?.maps) {
    throw new Error("Google Maps namespace missing after script load.");
  }

  // Prefer importLibrary when present (current Maps JS).
  if (typeof window.google.maps.importLibrary === "function") {
    await window.google.maps.importLibrary("maps");
    const places = (await window.google.maps.importLibrary("places")) as GooglePlacesLib;
    if (!places?.AutocompleteSuggestion || !places?.AutocompleteSessionToken) {
      throw new Error("Places library loaded without AutocompleteSuggestion.");
    }
    window.__gotrefsPlacesLib = places;
    return window.google;
  }

  // Legacy fallback: libraries=places already on the script URL
  if (!window.google.maps.Map) {
    throw new Error("Google Maps failed to initialize.");
  }
  const placesNs = window.google.maps.places;
  if (!placesNs?.AutocompleteSuggestion || !placesNs?.AutocompleteSessionToken) {
    throw new Error("Places Autocomplete (New) is unavailable on this key/project.");
  }
  window.__gotrefsPlacesLib = placesNs as unknown as GooglePlacesLib;
  return window.google;
}

/** Places library exports from importLibrary("places"). */
export async function loadGooglePlaces(): Promise<GooglePlacesLib> {
  await loadGoogleMaps();
  if (window.__gotrefsPlacesLib?.AutocompleteSuggestion) {
    return window.__gotrefsPlacesLib;
  }
  if (typeof google.maps.importLibrary === "function") {
    const places = (await google.maps.importLibrary("places")) as GooglePlacesLib;
    window.__gotrefsPlacesLib = places;
    return places;
  }
  throw new Error("Google Places library is unavailable.");
}

/**
 * Load Maps JS + Places once.
 * Uses callback= (not script.onload) because loading=async does not fire a usable load event.
 */
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
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      window.__gotrefsGoogleMapsPromise = undefined;
      reject(new Error(message));
    };
    const ok = (g: typeof google) => {
      if (settled) return;
      settled = true;
      resolve(g);
    };

    window.gm_authFailure = () => fail(mapsAuthErrorMessage());

    const finish = () => {
      void loadLibraries()
        .then(ok)
        .catch((err) => fail(err instanceof Error ? err.message : mapsAuthErrorMessage()));
    };

    if (window.google?.maps && (typeof window.google.maps.importLibrary === "function" || window.google.maps.Map)) {
      finish();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-gotrefs-google-maps]");
    if (existing) {
      window.__gotrefsInitMaps = finish;
      // If script already completed, google may already exist
      if (window.google?.maps) finish();
      return;
    }

    window.__gotrefsInitMaps = finish;
    const script = document.createElement("script");
    script.dataset.gotrefsGoogleMaps = "1";
    script.async = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&v=weekly&loading=async&libraries=places&callback=__gotrefsInitMaps`;
    script.onerror = () => fail("Google Maps failed to load.");
    document.head.appendChild(script);
  });

  return window.__gotrefsGoogleMapsPromise;
}
