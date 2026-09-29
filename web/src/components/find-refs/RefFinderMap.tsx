"use client";

import { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";

export type RefMapPin = {
  id: string;
  label: string;
  title: string;
  coords: { lat: number; lng: number };
};

const DEFAULT_CENTER = { lat: 33.95, lng: -118.25 };

/** Airbnb-style price pins for refs on Google Maps. */
export function RefFinderMap({
  pins,
  selectedId,
  center,
  onSelect,
  className = "h-full w-full",
}: {
  pins: RefMapPin[];
  selectedId?: string | null;
  center?: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const fittedKeyRef = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;
    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapElRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElRef.current, {
            center: DEFAULT_CENTER,
            zoom: 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
        }
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Google Maps failed to load."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fit only when the set of results or the searched place changes, not on selection.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const key = `${center?.lat},${center?.lng}|${pins.map((p) => p.id).join(",")}`;
    if (key === fittedKeyRef.current) return;
    fittedKeyRef.current = key;
    if (center) {
      map.panTo(center);
      map.setZoom(10);
    } else if (pins.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      pins.forEach((p) => bounds.extend(p.coords));
      map.fitBounds(bounds, 40);
    }
  }, [ready, pins, center]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = pins.map((pin) => {
      const active = pin.id === selectedId;
      const marker = new google.maps.Marker({
        map,
        position: pin.coords,
        title: pin.title,
        zIndex: active ? 1000 : undefined,
        label: {
          text: pin.label,
          color: active ? "#ffffff" : "#111827",
          fontSize: "12px",
          fontWeight: "700",
        },
        icon: {
          path: "M -26 -13 L 26 -13 Q 32 -13 32 -7 L 32 7 Q 32 13 26 13 L -26 13 Q -32 13 -32 7 L -32 -7 Q -32 -13 -26 -13 Z",
          fillColor: active ? "#111827" : "#ffffff",
          fillOpacity: 1,
          strokeColor: active ? "#111827" : "#d4d4d4",
          strokeWeight: 1,
          scale: 1,
          labelOrigin: new google.maps.Point(0, 1),
        },
      });
      marker.addListener("click", () => onSelect?.(pin.id));
      return marker;
    });
  }, [ready, pins, selectedId, onSelect]);

  if (!isGoogleMapsConfigured() || error) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 ${className}`}>
        <p className="max-w-xs px-4 text-center text-sm text-neutral-500">
          {error ? "The map couldn't load right now." : "Map unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-neutral-100 ${className}`}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-neutral-500">
          Loading map…
        </div>
      )}
      <div ref={mapElRef} className="h-full w-full" />
      <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-neutral-700 shadow">
        Pins show each ref&apos;s general area
      </p>
    </div>
  );
}
