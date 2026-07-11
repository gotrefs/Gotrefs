"use client";

import dynamic from "next/dynamic";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
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
  onSelect,
  onRequest,
  className,
}: {
  pins: MapGamePin[];
  selectedId?: string | null;
  center?: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  if (isGoogleMapsConfigured()) {
    return (
      <GoogleMarketplaceMap
        pins={pins}
        selectedId={selectedId}
        center={center}
        onSelect={onSelect}
        onRequest={onRequest}
        className={className}
      />
    );
  }
  return (
    <MarketplaceMapInner
      pins={pins}
      selectedId={selectedId}
      onSelect={onSelect}
      onRequest={onRequest}
      className={className}
    />
  );
}
