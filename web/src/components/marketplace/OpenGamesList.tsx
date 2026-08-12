"use client";

import { FindGamesExplorer } from "@/components/marketplace/FindGamesExplorer";

export function OpenGamesList({
  view = "list",
  canApplyToEvents,
  applyBlockedLabel,
  applicationPending,
  applicationRejected,
  onRequireProfile,
  onApplied,
  pendingInviteCount,
  onOpenTrips,
}: {
  view?: "list" | "map" | "split";
  canApplyToEvents?: boolean;
  applyBlockedLabel?: string;
  applicationPending?: boolean;
  applicationRejected?: boolean;
  onRequireProfile?: () => void;
  onApplied?: () => void;
  pendingInviteCount?: number;
  onOpenTrips?: () => void;
}) {
  return (
    <FindGamesExplorer
      view={view}
      canApplyToEvents={canApplyToEvents}
      applyBlockedLabel={applyBlockedLabel}
      applicationPending={applicationPending}
      applicationRejected={applicationRejected}
      onRequireProfile={onRequireProfile}
      onApplied={onApplied}
      pendingInviteCount={pendingInviteCount}
      onOpenTrips={onOpenTrips}
    />
  );
}
