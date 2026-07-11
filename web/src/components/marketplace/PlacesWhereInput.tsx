"use client";

import { useEffect, useRef } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";

export type PlaceSelection = {
  label: string;
  lat: number;
  lng: number;
};

type PlacesWhereInputProps = {
  id?: string;
  value: string;
  placeholder?: string;
  onChange: (label: string) => void;
  onPlaceSelect: (place: PlaceSelection | null) => void;
  className?: string;
};

/** Google Places autocomplete for the Airbnb-style Where field. */
export function PlacesWhereInput({
  id = "marketplace-where",
  value,
  placeholder = "Search destinations",
  onChange,
  onPlaceSelect,
  className = "",
}: PlacesWhereInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onChangeRef.current = onChange;
  onPlaceSelectRef.current = onPlaceSelect;

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;

    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current || autocompleteRef.current) return;
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name"],
          types: ["(cities)"],
          componentRestrictions: { country: ["us"] },
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          if (!loc) {
            onPlaceSelectRef.current(null);
            return;
          }
          const label =
            place.formatted_address?.trim() ||
            place.name?.trim() ||
            inputRef.current?.value.trim() ||
            "Selected place";
          onChangeRef.current(label);
          onPlaceSelectRef.current({ label, lat: loc.lat(), lng: loc.lng() });
        });
        autocompleteRef.current = autocomplete;
      })
      .catch(() => {
        // Key missing or script blocked — plain text input still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(event) => {
        onChange(event.target.value);
        onPlaceSelect(null);
      }}
      className={
        className ||
        "mt-0.5 w-full truncate border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 placeholder:text-neutral-400 outline-none focus:ring-0"
      }
    />
  );
}
