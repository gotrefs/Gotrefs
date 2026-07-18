"use client";

import { useEffect, useRef, useState } from "react";
import {
  isGoogleMapsConfigured,
  loadGooglePlaces,
  type GooglePlacesLib,
} from "@/lib/maps/google-maps-loader";

export type PlaceSelection = {
  label: string;
  lat: number;
  lng: number;
};

type SuggestionItem = {
  id: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

type PlacesWhereInputProps = {
  id?: string;
  value: string;
  placeholder?: string;
  onChange: (label: string) => void;
  onPlaceSelect: (place: PlaceSelection | null) => void;
  className?: string;
  /** Restrict Autocomplete primary types. Omit for broader results (e.g. street addresses). */
  includedPrimaryTypes?: string[];
};

/** Places Autocomplete (New) with our own dropdown — avoids legacy Autocomplete “Oops!” UI. */
export function PlacesWhereInput({
  id = "marketplace-where",
  value,
  placeholder = "Search destinations",
  onChange,
  onPlaceSelect,
  className = "",
  includedPrimaryTypes = ["locality", "sublocality", "postal_code", "administrative_area_level_3"],
}: PlacesWhereInputProps) {
  const [ready, setReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const placesRef = useRef<GooglePlacesLib | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;

    void loadGooglePlaces()
      .then((places) => {
        if (cancelled) return;
        placesRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
        setMapsError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setMapsError(err instanceof Error ? err.message : "Google Places failed to load.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!ready || !value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const places = placesRef.current;
    if (!places) return;

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new places.AutocompleteSessionToken();
          }
          const { suggestions: next } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value.trim(),
            ...(includedPrimaryTypes.length > 0 ? { includedPrimaryTypes } : {}),
            includedRegionCodes: ["us"],
            language: "en-US",
            region: "us",
            sessionToken: sessionTokenRef.current,
          });

          if (requestId !== requestIdRef.current) return;

          const items: SuggestionItem[] = [];
          for (const suggestion of next) {
            const prediction = suggestion.placePrediction;
            if (!prediction) continue;
            items.push({
              id: prediction.placeId || prediction.text.toString(),
              label: prediction.text.toString(),
              prediction,
            });
          }
          setSuggestions(items);
          setOpen(items.length > 0);
          setMapsError(null);
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          // Retry once without type filters — some keys reject certain primary types
          try {
            const { suggestions: fallback } =
              await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                input: value.trim(),
                includedRegionCodes: ["us"],
                language: "en-US",
                region: "us",
                sessionToken: sessionTokenRef.current ?? new places.AutocompleteSessionToken(),
              });
            if (requestId !== requestIdRef.current) return;
            const items: SuggestionItem[] = [];
            for (const suggestion of fallback) {
              const prediction = suggestion.placePrediction;
              if (!prediction) continue;
              items.push({
                id: prediction.placeId || prediction.text.toString(),
                label: prediction.text.toString(),
                prediction,
              });
            }
            setSuggestions(items);
            setOpen(items.length > 0);
            setMapsError(null);
          } catch (fallbackErr) {
            setMapsError(
              fallbackErr instanceof Error
                ? fallbackErr.message
                : err instanceof Error
                  ? err.message
                  : "Place search failed."
            );
          }
        }
      })();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [ready, value, includedPrimaryTypes]);

  async function selectSuggestion(item: SuggestionItem) {
    const places = placesRef.current;
    try {
      const place = item.prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      const loc = place.location;
      if (!loc) {
        onPlaceSelect(null);
        return;
      }
      const label =
        place.formattedAddress?.trim() ||
        place.displayName?.trim() ||
        item.label ||
        "Selected place";
      onChange(label);
      onPlaceSelect({ label, lat: loc.lat(), lng: loc.lng() });
      setSuggestions([]);
      setOpen(false);
      if (places) {
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      }
      setMapsError(null);
    } catch (err) {
      setMapsError(err instanceof Error ? err.message : "Could not load that place.");
    }
  }

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={mapsError ? "Place search unavailable" : placeholder}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          onPlaceSelect(null);
          setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        className={
          className ||
          "mt-0.5 w-full truncate border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 placeholder:text-neutral-400 outline-none focus:ring-0"
        }
      />
      {mapsError ? (
        <p className="mt-1 text-[11px] leading-snug text-amber-700">{mapsError}</p>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-56 overflow-auto rounded-2xl border border-neutral-200 bg-white py-1 shadow-lg">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full truncate px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void selectSuggestion(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
