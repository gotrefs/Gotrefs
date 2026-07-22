"use client";

import { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";

export type MatchingMapRefPin = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  travelRadiusMiles: number;
};

const DEFAULT_CENTER = { lat: 34.05, lng: -118.25 };

export function EventMatchingMap({
  eventCenter,
  refs,
  selectedId,
  onSelect,
  className = "h-full min-h-[28rem] w-full",
}: {
  eventCenter: { lat: number; lng: number } | null;
  refs: MatchingMapRefPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const eventMarkerRef = useRef<google.maps.Marker | null>(null);
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
            center: eventCenter ?? DEFAULT_CENTER,
            zoom: eventCenter ? 10 : 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
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
  }, [eventCenter]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    circlesRef.current.forEach((circle) => circle.setMap(null));
    circlesRef.current = [];
    if (eventMarkerRef.current) {
      eventMarkerRef.current.setMap(null);
      eventMarkerRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    if (eventCenter) {
      map.panTo(eventCenter);
      eventMarkerRef.current = new google.maps.Marker({
        map,
        position: eventCenter,
        title: "Event location",
        zIndex: 10,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#0D1B2A",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
      });
      bounds.extend(eventCenter);
    }

    for (const ref of refs) {
      const isActive = ref.id === selectedId;
      const selectPin = () => onSelect?.(ref.id);
      const radiusMeters = Math.max(ref.travelRadiusMiles, 1) * 1609.344;

      const circle = new google.maps.Circle({
        map,
        center: { lat: ref.lat, lng: ref.lng },
        radius: radiusMeters,
        fillColor: isActive ? "#111827" : "#d81d24",
        fillOpacity: isActive ? 0.18 : 0.1,
        strokeColor: isActive ? "#111827" : "#d81d24",
        strokeOpacity: 0.7,
        strokeWeight: isActive ? 2.5 : 1.5,
        clickable: true,
      });
      circle.addListener("click", selectPin);
      circlesRef.current.push(circle);

      const marker = new google.maps.Marker({
        map,
        position: { lat: ref.lat, lng: ref.lng },
        title: ref.label,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isActive ? 7 : 5,
          fillColor: isActive ? "#111827" : "#d81d24",
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", selectPin);
      markersRef.current.push(marker);
      bounds.extend({ lat: ref.lat, lng: ref.lng });
    }

    if (eventCenter || refs.length > 0) {
      map.fitBounds(bounds, 56);
      const listener = google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        const zoom = map.getZoom();
        if (typeof zoom === "number" && zoom > 12) map.setZoom(12);
      });
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
    map.panTo(DEFAULT_CENTER);
    map.setZoom(9);
  }, [ready, eventCenter, refs, selectedId, onSelect]);

  if (!isGoogleMapsConfigured()) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 ${className}`}
      >
        <p className="max-w-sm px-4 text-center text-sm text-neutral-500">
          Add <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the matching map.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 ${className}`}
      >
        <p className="max-w-sm px-4 text-center text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return <div ref={mapElRef} className={`overflow-hidden rounded-2xl bg-neutral-100 ${className}`} />;
}
