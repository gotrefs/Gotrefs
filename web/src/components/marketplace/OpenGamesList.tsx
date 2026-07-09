"use client";

import { FindGamesExplorer } from "@/components/marketplace/FindGamesExplorer";

export function OpenGamesList({
  view = "list",
  canApplyToEvents,
  applicationPending,
  applicationRejected,
  onRequireProfile,
  onApplied,
}: {
  view?: "list" | "map" | "split";
  canApplyToEvents?: boolean;
  applicationPending?: boolean;
  applicationRejected?: boolean;
  onRequireProfile?: () => void;
  onApplied?: () => void;
}) {
  return (
    <FindGamesExplorer
      view={view}
      canApplyToEvents={canApplyToEvents}
      applicationPending={applicationPending}
      applicationRejected={applicationRejected}
      onRequireProfile={onRequireProfile}
      onApplied={onApplied}
    />
  );
}
