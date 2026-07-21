"use client";

import dynamic from "next/dynamic";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
import { GamePinPreviewDrawer } from "@/components/marketplace/GamePinPreviewDrawer";
import { isGoogleMapsConfigured } from "@/lib/maps/google-maps-loader";

const GoogleMarketplaceMap = dynamic(
  () =>
    import("@/components/marketplace/GoogleMarketplaceMap").then((mod) => mod.GoogleMarketplaceMap),
  {
    ssr: false,
    loading: () => <div className="h-[min(70vh,640px)] w-full animate-pulse rounded-2xl bg-neutral-100" />,
  }
);

const MarketplaceMapInner = dynamic(
  () => import("@/components/marketplace/MarketplaceMapInner").then((mod) => mod.MarketplaceMapInner),
  {
    ssr: false,
    loading: () => <div className="h-[min(70vh,640px)] w-full animate-pulse rounded-2xl bg-neutral-100" />,
  }
);

export function MarketplaceMapView({
  pins,
  selectedId,
  center,
  requestedIds,
  requestingId,
  onSelect,
  onRequest,
  className,
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  center?: { lat: number; lng: number } | null;
  requestedIds?: Set<string>;
  requestingId?: string | null;
  onSelect?: (id: string | null) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  const selectedPin = selectedId ? pins.find((pin) => pin.id === selectedId) ?? null : null;
  const alreadyRequested = Boolean(
    selectedPin && (selectedPin.already_requested || requestedIds?.has(selectedPin.id))
  );
  const handleSelect = (id: string) => onSelect?.(id);

  return (
    <div className={`relative ${className ?? "h-[min(70vh,640px)] w-full"}`}>
      {isGoogleMapsConfigured() ? (
        <GoogleMarketplaceMap
          pins={pins}
          selectedId={selectedId}
          center={center}
          requestedIds={requestedIds}
          onSelect={handleSelect}
          onRequest={onRequest}
          className="h-full w-full rounded-2xl"
        />
      ) : (
        <MarketplaceMapInner
          pins={pins}
          selectedId={selectedId}
          requestedIds={requestedIds}
          onSelect={handleSelect}
          onRequest={onRequest}
          className="h-full w-full rounded-2xl"
        />
      )}
      <GamePinPreviewDrawer
        event={selectedPin}
        alreadyRequested={alreadyRequested}
        requesting={Boolean(selectedPin && requestingId === selectedPin.id)}
        onClose={() => onSelect?.(null)}
        onApply={(event) => onRequest?.(event)}
      />
    </div>
  );
}
