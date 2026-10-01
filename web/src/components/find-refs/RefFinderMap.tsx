"use client";

import { useEffect, useRef, useState } from "react";
import { isGoogleMapsConfigured, loadGoogleMaps } from "@/lib/maps/google-maps-loader";

export type RefMapPin = {
  id: string;
  label: string;
  title: string;
  coords: { lat: number; lng: number };
};

/** Continental US — the default view when no location is searched. */
const LOWER_48 = { north: 49.5, south: 24.4, west: -125, east: -66.9 };

type PinOverlay = google.maps.OverlayView & {
  setActive: (active: boolean) => void;
};

/**
 * Airbnb-style price pills drawn as plain HTML on a Google Maps OverlayView.
 * Uses only the core "maps" library, so it doesn't depend on google.maps.Marker.
 */
function createPinOverlay(
  pin: RefMapPin,
  active: boolean,
  onClick: (id: string) => void
): PinOverlay {
  class Pin extends google.maps.OverlayView {
    private el: HTMLButtonElement | null = null;
    private isActive = active;

    onAdd() {
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = pin.label;
      el.title = pin.title;
      el.setAttribute("aria-label", `${pin.title}, ${pin.label}`);
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-50%);padding:4px 9px;border-radius:999px;" +
        "font:700 12px/1.2 system-ui,sans-serif;white-space:nowrap;cursor:pointer;" +
        "box-shadow:0 1px 4px rgba(0,0,0,.28);border:1px solid #d4d4d4;transition:transform .12s;";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick(pin.id);
      });
      el.addEventListener("mouseenter", () => (el.style.transform = "translate(-50%,-50%) scale(1.08)"));
      el.addEventListener("mouseleave", () => (el.style.transform = "translate(-50%,-50%)"));
      this.el = el;
      this.paint();
      this.getPanes()?.overlayMouseTarget.appendChild(el);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection || !this.el) return;
      const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(pin.coords));
      if (!point) return;
      this.el.style.left = `${point.x}px`;
      this.el.style.top = `${point.y}px`;
    }

    onRemove() {
      this.el?.remove();
      this.el = null;
    }

    setActive(next: boolean) {
      this.isActive = next;
      this.paint();
    }

    private paint() {
      if (!this.el) return;
      this.el.style.background = this.isActive ? "#111827" : "#ffffff";
      this.el.style.color = this.isActive ? "#ffffff" : "#111827";
      this.el.style.zIndex = this.isActive ? "1000" : "1";
    }
  }
  return new Pin();
}

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
  const overlaysRef = useRef<Map<string, PinOverlay>>(new Map());
  const fittedKeyRef = useRef<string>("");
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;
    void loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapElRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElRef.current, {
            center: { lat: 39.5, lng: -98.35 },
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
          mapRef.current.fitBounds(LOWER_48, 0);
        }
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Google Maps failed to load."));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fit only when the searched place or the result set changes (not on hover/selection).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const key = `${center?.lat},${center?.lng}|${pins.map((p) => p.id).join(",")}`;
    if (key === fittedKeyRef.current) return;
    fittedKeyRef.current = key;
    if (center) {
      map.panTo(center);
      map.setZoom(10);
      return;
    }
    // Without a searched place, frame the lower 48 (Alaska/Hawaii pins stay reachable by panning).
    const mainland = pins.filter(
      (p) =>
        p.coords.lat <= LOWER_48.north &&
        p.coords.lat >= LOWER_48.south &&
        p.coords.lng >= LOWER_48.west &&
        p.coords.lng <= LOWER_48.east
    );
    if (mainland.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      mainland.forEach((p) => bounds.extend(p.coords));
      map.fitBounds(bounds, 32);
    } else if (pins.length === 1) {
      map.panTo(pins[0].coords);
      map.setZoom(10);
    } else {
      map.fitBounds(LOWER_48, 0);
    }
  }, [ready, pins, center]);

  // Add/remove pins when results change.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    const wanted = new Set(pins.map((p) => p.id));
    for (const [id, overlay] of overlays) {
      if (!wanted.has(id)) {
        overlay.setMap(null);
        overlays.delete(id);
      }
    }
    for (const pin of pins) {
      if (overlays.has(pin.id)) continue;
      const overlay = createPinOverlay(pin, false, (id) => onSelectRef.current?.(id));
      overlay.setMap(map);
      overlays.set(pin.id, overlay);
    }
  }, [ready, pins]);

  // Highlight the selected / hovered ref.
  useEffect(() => {
    for (const [id, overlay] of overlaysRef.current) overlay.setActive(id === selectedId);
  }, [selectedId, pins, ready]);

  // Clean up on unmount.
  useEffect(() => {
    const overlays = overlaysRef.current;
    return () => {
      for (const overlay of overlays.values()) overlay.setMap(null);
      overlays.clear();
    };
  }, []);

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
