"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { ZipCoordinates } from "@/lib/marketplace/zip-geocode";
import {
  approximateEventCoords,
  EVENT_PRIVACY_RADIUS_METERS,
  EVENT_PRIVACY_RADIUS_MILES,
} from "@/lib/maps/geo";
import "leaflet/dist/leaflet.css";

export type MapGamePin = OpenEventRecord & {
  coords: ZipCoordinates;
  /** True when coords are already jittered (~7 mi from true venue). */
  coordsPrivacyApplied?: boolean;
};

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;border-radius:999px;background:#d81d24;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const activePinIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:999px;background:#111827;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ pins }: { pins: Array<{ approx: { lat: number; lng: number } }> }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const padDeg = EVENT_PRIVACY_RADIUS_MILES / 69;
    if (pins.length === 1) {
      map.setView([pins[0].approx.lat, pins[0].approx.lng], 11);
      return;
    }
    const bounds = L.latLngBounds(
      pins.flatMap((pin) => [
        [pin.approx.lat + padDeg, pin.approx.lng] as [number, number],
        [pin.approx.lat - padDeg, pin.approx.lng] as [number, number],
        [pin.approx.lat, pin.approx.lng] as [number, number],
      ])
    );
    map.fitBounds(bounds.pad(0.12));
  }, [map, pins]);
  return null;
}

export function MarketplaceMapInner({
  pins,
  selectedId,
  onSelect,
  className = "h-[min(70vh,640px)] w-full rounded-2xl",
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  requestedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  const approxPins = useMemo(
    () =>
      pins.map((pin) => ({
        ...pin,
        approx: pin.coordsPrivacyApplied ? pin.coords : approximateEventCoords(pin.coords, pin.id),
      })),
    [pins]
  );

  const center = useMemo(() => {
    if (approxPins.length === 0) return { lat: 34.05, lng: -118.25 };
    const lat = approxPins.reduce((sum, pin) => sum + pin.approx.lat, 0) / approxPins.length;
    const lng = approxPins.reduce((sum, pin) => sum + pin.approx.lng, 0) / approxPins.length;
    return { lat, lng };
  }, [approxPins]);

  if (pins.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 ${className}`}>
        <p className="text-sm text-neutral-500">No mappable games in this search. Try another ZIP or date range.</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden border border-neutral-200 shadow-sm ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={approxPins} />
        {approxPins.map((pin) => {
          const isActive = selectedId === pin.id;
          return (
            <Circle
              key={`${pin.id}-circle`}
              center={[pin.approx.lat, pin.approx.lng]}
              radius={EVENT_PRIVACY_RADIUS_METERS}
              pathOptions={{
                color: isActive ? "#111827" : "#d81d24",
                fillColor: isActive ? "#111827" : "#d81d24",
                fillOpacity: isActive ? 0.22 : 0.14,
                weight: isActive ? 2.5 : 2,
              }}
              eventHandlers={{
                click: () => onSelect?.(pin.id),
              }}
            />
          );
        })}
        {approxPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.approx.lat, pin.approx.lng]}
            icon={selectedId === pin.id ? activePinIcon : pinIcon}
            eventHandlers={{
              click: () => onSelect?.(pin.id),
            }}
          />
        ))}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-neutral-700 shadow">
        Pins show approximate areas (~{EVENT_PRIVACY_RADIUS_MILES} mi) — exact address after booking
      </p>
    </div>
  );
}
