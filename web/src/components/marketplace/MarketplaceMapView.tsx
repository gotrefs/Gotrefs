"use client";

import dynamic from "next/dynamic";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";

const MarketplaceMapInner = dynamic(
  () => import("@/components/marketplace/MarketplaceMapInner").then((mod) => mod.MarketplaceMapInner),
  {
    ssr: false,
    loading: () => <div className="h-[min(70vh,640px)] w-full animate-pulse rounded-2xl bg-neutral-100" />,
  }
);

export function MarketplaceMapView(props: {
  pins: MapGamePin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onRequest?: (event: OpenEventRecord) => void;
  className?: string;
}) {
  return <MarketplaceMapInner {...props} />;
}
