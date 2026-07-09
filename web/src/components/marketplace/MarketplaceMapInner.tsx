"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { ZipCoordinates } from "@/lib/marketplace/zip-geocode";
import { formatPayRangeLabel } from "@/lib/pay-range";
import "leaflet/dist/leaflet.css";

export type MapGamePin = OpenEventRecord & {
  coords: ZipCoordinates;
};

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#d81d24;border:2px solid white;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

const activePinIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#111827;border:2px solid white;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function FitBounds({ pins }: { pins: MapGamePin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].coords.lat, pins[0].coords.lng], 11);
      return;
    }
    const bounds = L.latLngBounds(pins.map((pin) => [pin.coords.lat, pin.coords.lng]));
    map.fitBounds(bounds.pad(0.2));
  }, [map, pins]);
  return null;
}

function formatPay(event: OpenEventRecord) {
  return (
    formatPayRangeLabel({
      type: event.pay_type === "range" ? "range" : "exact",
      exact: event.pay_offer,
      min: event.pay_min,
      max: event.pay_max,
      unit: "hour",
    }) ?? "Pay TBD"
  );
}

export function MarketplaceMapInner({
  pins,
  selectedId,
  onSelect,
  onRequest,
  className = "h-[min(70vh,640px)] w-full rounded-2xl",
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  const center = useMemo(() => {
    if (pins.length === 0) return { lat: 34.05, lng: -118.25 };
    const lat = pins.reduce((sum, pin) => sum + pin.coords.lat, 0) / pins.length;
    const lng = pins.reduce((sum, pin) => sum + pin.coords.lng, 0) / pins.length;
    return { lat, lng };
  }, [pins]);

  if (pins.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 ${className}`}>
        <p className="text-sm text-neutral-500">No mappable games in this search. Try another ZIP or date range.</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden border border-neutral-200 shadow-sm ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={10} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.coords.lat, pin.coords.lng]}
            icon={selectedId === pin.id ? activePinIcon : pinIcon}
            eventHandlers={{
              click: () => onSelect?.(pin.id),
            }}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1">
                <p className="font-semibold text-neutral-900">{pin.title}</p>
                <p className="text-xs text-neutral-600">{pin.sport}</p>
                <p className="text-xs text-neutral-600">{new Date(pin.starts_at).toLocaleString()}</p>
                <p className="text-sm font-semibold text-neutral-900">{formatPay(pin)}</p>
                {onRequest && (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => onRequest(pin)}
                  >
                    Request to work
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
