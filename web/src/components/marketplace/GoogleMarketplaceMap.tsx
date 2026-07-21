"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";
import {
  approximateEventCoords,
  EVENT_PRIVACY_RADIUS_METERS,
  EVENT_PRIVACY_RADIUS_MILES,
} from "@/lib/maps/geo";

const DEFAULT_CENTER = { lat: 34.05, lng: -118.25 };

function approxCenter(pin: MapGamePin) {
  return pin.coordsPrivacyApplied ? pin.coords : approximateEventCoords(pin.coords, pin.id);
}

export function GoogleMarketplaceMap({
  pins,
  selectedId,
  center,
  onSelect,
  className = "h-[min(70vh,640px)] w-full rounded-2xl",
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  center?: { lat: number; lng: number } | null;
  requestedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
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
            center: center ?? DEFAULT_CENTER,
            zoom: center ? 10 : 9,
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
        const message = err instanceof Error ? err.message : "Google Maps failed to load.";
        setError(message);
        setReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [center]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    circlesRef.current.forEach((circle) => circle.setMap(null));
    circlesRef.current = [];

    const approxPins = pins.map((pin) => ({ pin, center: approxCenter(pin) }));

    if (center) {
      map.panTo(center);
      map.setZoom(10);
    } else if (approxPins.length === 1) {
      map.panTo(approxPins[0].center);
      map.setZoom(11);
    } else if (approxPins.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      const padDeg = EVENT_PRIVACY_RADIUS_MILES / 69;
      for (const { center: c } of approxPins) {
        bounds.extend(c);
        bounds.extend({ lat: c.lat + padDeg, lng: c.lng });
        bounds.extend({ lat: c.lat - padDeg, lng: c.lng });
      }
      map.fitBounds(bounds, 48);
    } else {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(9);
    }

    for (const { pin, center: pinCenter } of approxPins) {
      const isActive = pin.id === selectedId;
      const selectPin = () => onSelect?.(pin.id);

      const circle = new google.maps.Circle({
        map,
        center: pinCenter,
        radius: EVENT_PRIVACY_RADIUS_METERS,
        fillColor: isActive ? "#111827" : "#d81d24",
        fillOpacity: isActive ? 0.22 : 0.14,
        strokeColor: isActive ? "#111827" : "#d81d24",
        strokeOpacity: 0.75,
        strokeWeight: isActive ? 2.5 : 2,
        clickable: true,
      });
      circle.addListener("click", selectPin);
      circlesRef.current.push(circle);

      const marker = new google.maps.Marker({
        map,
        position: pinCenter,
        title: pin.title,
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
    }
  }, [ready, pins, selectedId, center, onSelect]);

  if (!isGoogleMapsConfigured()) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 ${className}`}
      >
        <p className="max-w-sm px-4 text-center text-sm text-neutral-500">
          Add <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable Google Maps.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50 ${className}`}
      >
        <p className="max-w-md px-4 text-center text-sm text-red-800">
          Map could not load. Check your API key restrictions include this site
          (<code className="text-xs">https://gotrefs.org/*</code> and{" "}
          <code className="text-xs">http://localhost:3000/*</code>).
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
        Pins show approximate areas (~{EVENT_PRIVACY_RADIUS_MILES} mi) — exact address after booking
      </p>
    </div>
  );
}
