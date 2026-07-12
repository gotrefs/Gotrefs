/** Browser Google Maps API key (Maps JavaScript + Places). */
export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

declare global {
  interface Window {
    google?: typeof google;
    __gotrefsGoogleMapsPromise?: Promise<typeof google>;
    gm_authFailure?: () => void;
  }
}

function mapsAuthErrorMessage() {
  return (
    "Google Maps rejected this API key. Enable billing, turn on Maps JavaScript API + Places API, " +
    "and allow this site under HTTP referrers (https://gotrefs.org/* and http://localhost:3000/*)."
  );
}

/** Load Maps JS + Places once. Rejects if the API key is missing or auth fails. */
export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (window.google?.maps?.places) {
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

    const existing = document.querySelector<HTMLScriptElement>("script[data-gotrefs-google-maps]");
    if (existing) {
      if (window.google?.maps?.places) {
        resolve(window.google);
        return;
      }
      existing.addEventListener("load", () => {
        if (window.google?.maps?.places) resolve(window.google);
        else fail("Google Maps failed to load Places.");
      });
      existing.addEventListener("error", () => fail("Google Maps failed to load."));
      return;
    }

    const script = document.createElement("script");
    script.dataset.gotrefsGoogleMaps = "1";
    script.async = true;
    script.defer = true;
    // loading=async is required by current Maps JS best practices
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&v=weekly`;
    script.onload = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else fail("Google Maps loaded without Places library.");
    };
    script.onerror = () => fail("Google Maps failed to load.");
    document.head.appendChild(script);
  });

  return window.__gotrefsGoogleMapsPromise;
}
