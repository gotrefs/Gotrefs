"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";
import { formatPayRangeLabel } from "@/lib/pay-range";

const DEFAULT_CENTER = { lat: 34.05, lng: -118.25 };

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

export function GoogleMarketplaceMap({
  pins,
  selectedId,
  center,
  onSelect,
  onRequest,
  className = "h-[min(70vh,640px)] w-full rounded-2xl",
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  center?: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
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
            zoom: center ? 11 : 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });
          infoRef.current = new google.maps.InfoWindow();
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

    if (center) {
      map.panTo(center);
      map.setZoom(11);
    } else if (pins.length === 1) {
      map.panTo(pins[0].coords);
      map.setZoom(11);
    } else if (pins.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      pins.forEach((pin) => bounds.extend(pin.coords));
      map.fitBounds(bounds, 48);
    } else {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(9);
    }

    for (const pin of pins) {
      const isActive = pin.id === selectedId;
      const marker = new google.maps.Marker({
        map,
        position: pin.coords,
        title: pin.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isActive ? 11 : 9,
          fillColor: isActive ? "#111827" : "#d81d24",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        onSelect?.(pin.id);
        const place = [pin.city, pin.state].filter(Boolean).join(", ") || pin.zip_code;
        const content = document.createElement("div");
        content.className = "p-1";
        content.innerHTML = `
          <p style="margin:0;font-weight:700;font-size:13px">${pin.title}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#555">${pin.sport} · ${place}</p>
          <p style="margin:4px 0 8px;font-size:12px;color:#555">${formatPay(pin)}</p>
        `;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Request to work";
        btn.style.cssText =
          "border:0;border-radius:999px;background:#d81d24;color:#fff;font-size:12px;font-weight:700;padding:6px 12px;cursor:pointer";
        btn.onclick = () => onRequest?.(pin);
        content.appendChild(btn);
        infoRef.current?.setContent(content);
        infoRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
    }
  }, [ready, pins, selectedId, center, onSelect, onRequest]);

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
    </div>
  );
}
