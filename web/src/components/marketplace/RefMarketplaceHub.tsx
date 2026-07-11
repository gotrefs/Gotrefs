"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefEventCalendar } from "@/components/RefEventCalendar";
import { OpenGamesList } from "@/components/marketplace/OpenGamesList";
import {
  RefMyWorkPanel,
  type RefWorkApplication,
  type RefWorkBooking,
  type RefWorkOffer,
} from "@/components/marketplace/RefMyWorkPanel";

type HubTab = "find-games" | "my-work";
type FindView = "list" | "map" | "calendar";

export function RefMarketplaceHub({
  canApplyToEvents,
  applicationPending,
  applicationRejected,
  onRequireProfile,
  onReload,
  offers,
  applications,
  bookings,
}: {
  canApplyToEvents: boolean;
  applicationPending: boolean;
  applicationRejected: boolean;
  onRequireProfile?: () => void;
  onReload: () => Promise<void> | void;
  offers: RefWorkOffer[];
  applications: RefWorkApplication[];
  bookings: RefWorkBooking[];
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "my-work" ? "my-work" : "find-games";
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [findView, setFindView] = useState<FindView>("map");

  useEffect(() => {
    if (searchParams.get("panel") === "offers" || searchParams.get("tab") === "my-work") {
      setTab("my-work");
    }
  }, [searchParams]);

  const pendingInviteCount = offers.filter((offer) => offer.status === "pending").length;

  const tabs: { id: HubTab; label: string; badge?: number }[] = [
    { id: "find-games", label: "Explore" },
    { id: "my-work", label: "Trips", badge: pendingInviteCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div className="flex flex-wrap gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === item.id
                  ? "text-neutral-900 after:absolute after:bottom-[-17px] after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              }`}
            >
              {item.label}
              {item.badge ? (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "find-games" && (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-neutral-500 sm:inline">View</span>
            <div className="flex rounded-full border border-neutral-300 bg-white p-0.5 text-sm font-semibold shadow-sm">
              {(
                [
                  { id: "list", label: "List" },
                  { id: "map", label: "Map" },
                  { id: "calendar", label: "Calendar" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFindView(mode.id)}
                  className={`rounded-full px-3.5 py-1.5 transition ${
                    findView === mode.id
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {tab === "find-games" && (
        <div className="space-y-6">
          {findView === "calendar" ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <RefEventCalendar
                embedded
                canApplyToEvents={canApplyToEvents}
                applicationPending={applicationPending}
                applicationRejected={applicationRejected}
                onRequireProfile={onRequireProfile}
              />
            </div>
          ) : (
            <OpenGamesList
              view={findView === "map" ? "split" : "list"}
              canApplyToEvents={canApplyToEvents}
              applicationPending={applicationPending}
              applicationRejected={applicationRejected}
              onRequireProfile={onRequireProfile}
              onApplied={() => void onReload()}
            />
          )}
        </div>
      )}

      {tab === "my-work" && (
        <RefMyWorkPanel
          offers={offers}
          applications={applications}
          bookings={bookings}
          onReload={onReload}
        />
      )}
    </div>
  );
}
