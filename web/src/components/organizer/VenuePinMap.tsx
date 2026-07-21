"use client";

import { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";

type VenuePinMapProps = {
  center: { lat: number; lng: number };
  onCenterChange: (coords: { lat: number; lng: number }) => void;
  addressLabel?: string;
  approximate?: boolean;
  className?: string;
};

/**
 * Airbnb-style pin map: pin stays centered; user pans the map underneath.
 */
export function VenuePinMap({
  center,
  onCenterChange,
  addressLabel,
  approximate = false,
  className = "h-[min(62vh,520px)] w-full",
}: VenuePinMapProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setError("Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map pin.");
      return;
    }
    let cancelled = false;

    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapElRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElRef.current, {
            center,
            zoom: approximate ? 9 : 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            gestureHandling: "greedy",
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          });

          mapRef.current.addListener("idle", () => {
            const map = mapRef.current;
            if (!map) return;
            const c = map.getCenter();
            if (!c) return;
            onCenterChangeRef.current({ lat: c.lat(), lng: c.lng() });
          });
        }
        setReady(true);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Google Maps failed to load.");
        setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !window.google?.maps) return;
    const current = map.getCenter();
    if (
      !current ||
      Math.abs(current.lat() - center.lat) > 0.00008 ||
      Math.abs(current.lng() - center.lng) > 0.00008
    ) {
      map.panTo(center);
    }

    if (approximate) {
      const privacyRadiusMeters = 75 * 1609.344; // ~75 miles — hides exact venue from browsing refs
      map.setZoom(Math.min(map.getZoom() ?? 9, 9));
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          map,
          center,
          radius: privacyRadiusMeters,
          strokeColor: "#717171",
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: "#717171",
          fillOpacity: 0.18,
          clickable: false,
        });
      } else {
        circleRef.current.setMap(map);
        circleRef.current.setCenter(center);
        circleRef.current.setRadius(privacyRadiusMeters);
      }
    } else if (circleRef.current) {
      circleRef.current.setMap(null);
    }
  }, [center, ready, approximate]);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-neutral-100 ${className}`}>
      <div ref={mapElRef} className="h-full w-full" />

      {addressLabel ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(92%,420px)] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 shadow-md">
            <span className="text-neutral-800" aria-hidden>
              📍
            </span>
            <p className="truncate text-sm font-medium text-neutral-800">{addressLabel}</p>
          </div>
        </div>
      ) : null}

      {/* Fixed center pin */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[88%]">
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20V9.5L12 4l8 5.5V20h-5.5v-5.5h-5V20H4Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {!approximate ? (
            <div className="mt-2 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow">
              Drag the map to reposition the pin
            </div>
          ) : null}
        </div>
      </div>

      {!ready && !error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-sm text-neutral-500">
          Loading map…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 px-6 text-center text-sm text-amber-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}
