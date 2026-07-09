"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_SPORTS, OTHER_SPORT_VALUE } from "@/data/sports";
import { AirbnbFilterChips, AirbnbMarketplaceSearch } from "@/components/marketplace/AirbnbMarketplaceSearch";
import { GameListingCard } from "@/components/marketplace/GameListingCard";
import { MarketplaceMapView } from "@/components/marketplace/MarketplaceMapView";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
import { StickyMarketplaceSearch } from "@/components/marketplace/StickyMarketplaceSearch";
import {
  payMatchLabel,
  type OpenEventRecord,
  type RefProfileForMatch,
} from "@/lib/marketplace/event-filters";
import { geocodeZipBatch } from "@/lib/marketplace/zip-geocode";

const QUICK_SPORTS = ["Basketball", "Soccer", "Football", "Volleyball", "Baseball"];

export function FindGamesExplorer({
  view,
  canApplyToEvents,
  applicationPending,
  applicationRejected,
  onRequireProfile,
  onApplied,
}: {
  view: "list" | "map" | "split";
  canApplyToEvents?: boolean;
  applicationPending?: boolean;
  applicationRejected?: boolean;
  onRequireProfile?: () => void;
  onApplied?: () => void;
}) {
  const [sport, setSport] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [zip, setZip] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payMatchesRef, setPayMatchesRef] = useState(false);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [events, setEvents] = useState<OpenEventRecord[]>([]);
  const [refProfile, setRefProfile] = useState<RefProfileForMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapPins, setMapPins] = useState<MapGamePin[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const effectiveSport =
    activeChip ?? (sport === OTHER_SPORT_VALUE ? customSport.trim() : sport);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (effectiveSport.trim()) params.set("sport", effectiveSport.trim());
    if (zip.trim()) params.set("zip", zip.trim());
    if (dateFrom) params.set("startsAfter", new Date(dateFrom).toISOString());
    if (dateTo) params.set("startsBefore", new Date(`${dateTo}T23:59:59`).toISOString());
    if (payMatchesRef) params.set("payMatchesRef", "true");
    try {
      const res = await fetch(`/api/events/open?${params.toString()}`);
      const json = (await res.json()) as {
        events?: OpenEventRecord[];
        refProfile?: RefProfileForMatch | null;
        error?: string;
      };
      if (!res.ok) {
        setMsg(json.error || "Could not load open games.");
        setEvents([]);
        return;
      }
      setEvents(json.events ?? []);
      setRefProfile(json.refProfile ?? null);
    } catch {
      setMsg("Could not reach the server.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveSport, zip, dateFrom, dateTo, payMatchesRef]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (view === "list") return;
    let cancelled = false;
    async function buildPins() {
      setMapLoading(true);
      const coordsByZip = await geocodeZipBatch(events.map((event) => event.zip_code));
      if (cancelled) return;
      const pins: MapGamePin[] = [];
      for (const event of events) {
        const zipKey = event.zip_code.trim().slice(0, 5);
        const coords = coordsByZip.get(zipKey);
        if (coords) pins.push({ ...event, coords });
      }
      setMapPins(pins);
      setMapLoading(false);
    }
    void buildPins();
    return () => {
      cancelled = true;
    };
  }, [events, view]);

  async function applyToEvent(event: OpenEventRecord) {
    setMsg(null);
    if (!canApplyToEvents) {
      if (applicationPending) {
        setMsg("Application pending — you can apply once GotREFS approves your verification.");
        return;
      }
      if (applicationRejected) {
        setMsg("Verification not approved. Check your notification inbox.");
        return;
      }
      onRequireProfile?.();
      return;
    }
    setSubmittingId(event.id);
    try {
      const res = await fetch("/api/events/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const json = (await res.json()) as { error?: string; eventTitle?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not apply.");
        return;
      }
      setMsg(`Request sent for "${json.eventTitle ?? event.title}".`);
      onApplied?.();
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setSubmittingId(null);
    }
  }

  const showSplit = view === "split" || view === "map";
  const showGrid = view === "list" || view === "split";

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedMapId) ?? null,
    [events, selectedMapId]
  );

  return (
    <div className="space-y-6">
      <StickyMarketplaceSearch>
        <AirbnbMarketplaceSearch
          onSearch={() => void load()}
          searchLabel="Search games"
          fields={[
            {
              id: "marketplace-sport",
              label: "Sport",
              value: sport,
              type: "select",
              options: [
                { value: "", label: "Any sport" },
                ...ALL_SPORTS.map((s) => ({ value: s, label: s })),
                { value: OTHER_SPORT_VALUE, label: "Other" },
              ],
              onChange: (value) => {
                setSport(value);
                setActiveChip(null);
                if (value !== OTHER_SPORT_VALUE) setCustomSport("");
              },
            },
            ...(sport === OTHER_SPORT_VALUE
              ? [
                  {
                    id: "marketplace-sport-custom",
                    label: "Your sport",
                    value: customSport,
                    placeholder: "e.g., Pickleball",
                    onChange: setCustomSport,
                  },
                ]
              : []),
            {
              id: "marketplace-when-start",
              label: "From",
              value: dateFrom,
              type: "date",
              onChange: setDateFrom,
            },
            {
              id: "marketplace-when-end",
              label: "Until",
              value: dateTo,
              type: "date",
              onChange: setDateTo,
            },
            {
              id: "marketplace-where",
              label: "ZIP code",
              value: zip,
              placeholder: "Where",
              onChange: setZip,
            },
          ]}
        />
      </StickyMarketplaceSearch>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AirbnbFilterChips
          chips={QUICK_SPORTS.map((s) => ({ id: s, label: s }))}
          activeId={activeChip}
          onSelect={(id) => {
            setActiveChip(id);
            if (id) setSport(id);
            else setSport("");
          }}
        />
        <label className="flex shrink-0 items-center gap-2 rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">
          <input
            type="checkbox"
            checked={payMatchesRef}
            onChange={(e) => setPayMatchesRef(e.target.checked)}
            className="h-3.5 w-3.5 accent-neutral-900"
          />
          Matches my rate
        </label>
      </div>

      {msg && (
        <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800">
          {msg}
        </p>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-neutral-900">
          {loading ? "Searching…" : `${events.length} game${events.length === 1 ? "" : "s"}`}
        </h3>
        {showSplit && !mapLoading && (
          <p className="text-sm text-neutral-500">{mapPins.length} on map</p>
        )}
      </div>

      <div
        className={
          showSplit
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start"
            : ""
        }
      >
        {showGrid && (
          <div className={showSplit ? "max-h-[min(75vh,720px)] space-y-4 overflow-y-auto pr-1" : ""}>
            {loading ? (
              <div className={`grid gap-6 ${showSplit ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                {Array.from({ length: showSplit ? 4 : 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse overflow-hidden rounded-xl bg-neutral-100">
                    <div className="aspect-[4/3] bg-neutral-200" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 w-3/4 rounded bg-neutral-200" />
                      <div className="h-3 w-1/2 rounded bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
                <p className="text-4xl" aria-hidden="true">
                  🏟️
                </p>
                <p className="mt-3 text-lg font-semibold text-neutral-900">No games match your search</p>
                <p className="mt-1 text-sm text-neutral-500">Try different dates, a nearby ZIP, or turn off rate matching.</p>
              </div>
            ) : (
              <div className={`grid gap-6 ${showSplit ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                {events.map((event) => {
                  const slotsLeft = Math.max(0, event.officials_needed - (event.booked_count ?? 0));
                  const isSelected = selectedMapId === event.id;
                  return (
                    <div
                      key={event.id}
                      className={isSelected && showSplit ? "rounded-xl ring-2 ring-neutral-900 ring-offset-2" : ""}
                      onMouseEnter={() => showSplit && setSelectedMapId(event.id)}
                    >
                      <GameListingCard
                        event={event}
                        payBadge={payMatchLabel(refProfile, event)}
                        slotsLeft={slotsLeft}
                        ctaLabel="Request to work"
                        ctaDisabled={slotsLeft === 0}
                        ctaLoading={submittingId === event.id}
                        onAction={() => void applyToEvent(event)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showSplit && (
          <div className="lg:sticky lg:top-24">
            {mapLoading ? (
              <div className="h-[min(70vh,640px)] w-full animate-pulse rounded-2xl bg-neutral-100" />
            ) : (
              <MarketplaceMapView
                pins={mapPins}
                selectedId={selectedMapId}
                onSelect={setSelectedMapId}
                onRequest={(event) => void applyToEvent(event)}
              />
            )}
            {selectedEvent && (
              <p className="mt-3 text-sm text-neutral-600">
                Selected: <span className="font-semibold text-neutral-900">{selectedEvent.title}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
