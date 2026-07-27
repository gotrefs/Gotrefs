"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ALL_SPORTS } from "@/data/sports";
import { AirbnbMarketplaceSearch } from "@/components/marketplace/AirbnbMarketplaceSearch";
import { GameDetailsApplyModal } from "@/components/marketplace/GameDetailsApplyModal";
import { GameListingCard } from "@/components/marketplace/GameListingCard";
import { MarketplaceMapView } from "@/components/marketplace/MarketplaceMapView";
import type { MapGamePin } from "@/components/marketplace/MarketplaceMapInner";
import { PlacesWhereInput } from "@/components/marketplace/PlacesWhereInput";
import {
  isEventOpenForRequests,
  payMatchLabel,
  type OpenEventRecord,
  type RefProfileForMatch,
} from "@/lib/marketplace/event-filters";
import { DEFAULT_SEARCH_RADIUS_MILES, distanceMiles } from "@/lib/maps/geo";
import { isGoogleMapsConfigured } from "@/lib/maps/google-maps-loader";
import { geocodeZipBatch } from "@/lib/marketplace/zip-geocode";

function startOfLocalDayIso(dateValue: string): string | null {
  if (!dateValue.trim()) return null;
  const date = new Date(`${dateValue.trim()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function endOfLocalDayIso(dateValue: string): string | null {
  if (!dateValue.trim()) return null;
  const date = new Date(`${dateValue.trim()}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatWhenSummary(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Until ${dateTo}`;
  return "";
}

export function FindGamesExplorer({
  view,
  onApplied,
  pendingInviteCount = 0,
  onOpenTrips,
}: {
  view: "list" | "map" | "split";
  canApplyToEvents?: boolean;
  applicationPending?: boolean;
  applicationRejected?: boolean;
  onRequireProfile?: () => void;
  onApplied?: () => void;
  pendingInviteCount?: number;
  onOpenTrips?: () => void;
}) {
  const [sport, setSport] = useState("");
  const [whereLabel, setWhereLabel] = useState("");
  const [wherePlace, setWherePlace] = useState<{ label: string; lat: number; lng: number } | null>(
    null
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [events, setEvents] = useState<OpenEventRecord[]>([]);
  const [refProfile, setRefProfile] = useState<RefProfileForMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapPins, setMapPins] = useState<MapGamePin[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [locationFilteredIds, setLocationFilteredIds] = useState<Set<string> | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [detailsEvent, setDetailsEvent] = useState<OpenEventRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    const params = new URLSearchParams();
    // Only apply filters the user set — empty means "any".
    if (sport.trim()) params.set("sport", sport.trim());

    const fromIso = startOfLocalDayIso(dateFrom);
    const toIso = endOfLocalDayIso(dateTo);
    if (fromIso) params.set("startsAfter", fromIso);
    if (toIso) params.set("startsBefore", toIso);

    try {
      const res = await fetch(`/api/events/open?${params.toString()}`);
      const json = (await res.json()) as {
        events?: OpenEventRecord[];
        refProfile?: RefProfileForMatch | null;
        error?: string;
      };
      if (!res.ok) {
        setMsg({ text: json.error || "Could not load open games.", tone: "err" });
        setEvents([]);
        return;
      }
      const openEvents = (json.events ?? []).filter((event) => isEventOpenForRequests(event));
      setEvents(openEvents);
      setRefProfile(json.refProfile ?? null);
      setRequestedIds(
        new Set(openEvents.filter((event) => event.already_requested).map((event) => event.id))
      );
    } catch {
      setMsg({ text: "Could not reach the server.", tone: "err" });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [sport, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Where filter (AND with sport/when): keep games within ~40 miles of the selected place.
  useEffect(() => {
    let cancelled = false;

    async function applyWhereFilter() {
      if (!wherePlace) {
        setLocationFilteredIds(null);
        return;
      }

      const coordsByZip = await geocodeZipBatch(events.map((event) => event.zip_code));
      if (cancelled) return;

      const allowed = new Set<string>();
      for (const event of events) {
        let lat: number | null = null;
        let lng: number | null = null;
        if (
          typeof event.map_lat === "number" &&
          typeof event.map_lng === "number" &&
          Number.isFinite(event.map_lat) &&
          Number.isFinite(event.map_lng)
        ) {
          lat = event.map_lat;
          lng = event.map_lng;
        } else {
          const zipKey = event.zip_code.trim().slice(0, 5);
          const coords = coordsByZip.get(zipKey);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }
        if (lat == null || lng == null) continue;
        if (distanceMiles(wherePlace, { lat, lng }) <= DEFAULT_SEARCH_RADIUS_MILES) {
          allowed.add(event.id);
        }
      }
      setLocationFilteredIds(allowed);
    }

    void applyWhereFilter();
    return () => {
      cancelled = true;
    };
  }, [events, wherePlace]);

  useEffect(() => {
    if (view === "list") return;
    let cancelled = false;
    async function buildPins() {
      setMapLoading(true);
      const coordsByZip = await geocodeZipBatch(events.map((event) => event.zip_code));
      if (cancelled) return;

      let pins: MapGamePin[] = [];
      for (const event of events) {
        if (
          typeof event.map_lat === "number" &&
          typeof event.map_lng === "number" &&
          Number.isFinite(event.map_lat) &&
          Number.isFinite(event.map_lng)
        ) {
          pins.push({
            ...event,
            coords: {
              lat: event.map_lat,
              lng: event.map_lng,
              place: [event.city, event.state].filter(Boolean).join(", ") || event.zip_code,
            },
            coordsPrivacyApplied: true,
          });
          continue;
        }
        const zipKey = event.zip_code.trim().slice(0, 5);
        const coords = coordsByZip.get(zipKey);
        if (coords) pins.push({ ...event, coords, coordsPrivacyApplied: false });
      }

      if (wherePlace) {
        pins = pins.filter(
          (pin) =>
            distanceMiles(wherePlace, { lat: pin.coords.lat, lng: pin.coords.lng }) <=
            DEFAULT_SEARCH_RADIUS_MILES
        );
      }

      setMapPins(pins);
      setMapLoading(false);
    }
    void buildPins();
    return () => {
      cancelled = true;
    };
  }, [events, view, wherePlace]);

  const displayEvents = useMemo(() => {
    if (!wherePlace) return events;
    if (!locationFilteredIds) return events;
    return events.filter((event) => locationFilteredIds.has(event.id));
  }, [events, wherePlace, locationFilteredIds]);

  async function applyToEvent(event: OpenEventRecord) {
    setMsg(null);
    if (event.already_requested || requestedIds.has(event.id)) {
      setMsg({ text: "You already requested to work this game.", tone: "ok" });
      return;
    }
    setSubmittingId(event.id);
    setRequestedIds((prev) => new Set(prev).add(event.id));
    try {
      const res = await fetch("/api/events/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const json = (await res.json()) as {
        error?: string;
        eventTitle?: string;
        pendingVerification?: boolean;
        status?: string;
      };
      if (!res.ok) {
        setRequestedIds((prev) => {
          const next = new Set(prev);
          next.delete(event.id);
          return next;
        });
        setMsg({ text: json.error || "Could not apply.", tone: "err" });
        return;
      }
      setEvents((prev) =>
        prev.map((row) => (row.id === event.id ? { ...row, already_requested: true } : row))
      );
      setMapPins((prev) =>
        prev.map((pin) => (pin.id === event.id ? { ...pin, already_requested: true } : pin))
      );
      setDetailsEvent((prev) =>
        prev?.id === event.id ? { ...prev, already_requested: true } : prev
      );
      if (json.pendingVerification) {
        setMsg({
          text:
            json.status ||
            "Your status is pending — once GotREFS approves your verification, the organizer will be notified automatically.",
          tone: "ok",
        });
      } else {
        setMsg({
          text: `Requested to work “${json.eventTitle ?? event.title}”. The organizer will review your GotREFS ID.`,
          tone: "ok",
        });
      }
      onApplied?.();
    } catch {
      setRequestedIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      setMsg({ text: "Could not reach the server.", tone: "err" });
    } finally {
      setSubmittingId(null);
    }
  }

  const showSplit = view === "split" || view === "map";
  const showGrid = view === "list" || view === "split";
  const whenSummary = formatWhenSummary(dateFrom, dateTo);

  function syncDateFrom(value: string) {
    setDateFrom(value);
    if (dateTo && value && value > dateTo) setDateTo(value);
  }

  function syncDateTo(value: string) {
    setDateTo(value);
    if (dateFrom && value && value < dateFrom) setDateFrom(value);
  }

  return (
    <div className="space-y-6">
      <AirbnbMarketplaceSearch
        onSearch={() => void load()}
        searchLabel="Search"
        fields={[
          {
            id: "marketplace-where",
            label: "Where",
            value: whereLabel,
            placeholder: "Search destinations",
            onChange: (value) => {
              setWhereLabel(value);
              if (!value.trim()) setWherePlace(null);
            },
            renderInput: () => (
              <PlacesWhereInput
                id="marketplace-where"
                value={whereLabel}
                placeholder={
                  isGoogleMapsConfigured()
                    ? "Search destinations"
                    : "Add Google Maps API key for place search"
                }
                onChange={(value) => {
                  setWhereLabel(value);
                  if (!value.trim()) setWherePlace(null);
                }}
                onPlaceSelect={setWherePlace}
              />
            ),
          },
          {
            id: "marketplace-when",
            label: "When",
            value: whenSummary,
            placeholder: "Add dates",
            onChange: () => undefined,
            renderInput: () => (
              <div className="mt-0.5 flex items-center gap-2">
                <input
                  id="marketplace-when-from"
                  type="date"
                  value={dateFrom}
                  aria-label="From date"
                  onChange={(e) => syncDateFrom(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 outline-none focus:ring-0"
                />
                <span className="shrink-0 text-xs font-semibold text-neutral-400">to</span>
                <input
                  id="marketplace-when-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  aria-label="To date"
                  onChange={(e) => syncDateTo(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 outline-none focus:ring-0"
                />
              </div>
            ),
          },
          {
            id: "marketplace-sport",
            label: "Sport",
            value: sport,
            type: "select",
            options: [
              { value: "", label: "Any sport" },
              ...ALL_SPORTS.map((s) => ({ value: s, label: s })),
            ],
            onChange: setSport,
          },
        ]}
      />

      {!isGoogleMapsConfigured() && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Set <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in{" "}
          <code className="text-xs">web/.env.local</code> to enable destination search and Google Maps.
        </p>
      )}

      {msg && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${
            msg.tone === "err"
              ? "border-red-200 bg-red-50 text-red-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold text-neutral-900">
          {loading
            ? "Searching…"
            : `${displayEvents.length} game${displayEvents.length === 1 ? "" : "s"}${
                wherePlace ? ` near ${wherePlace.label.split(",")[0]}` : ""
              }${whenSummary ? ` · ${whenSummary}` : ""}${sport ? ` · ${sport}` : ""}`}
        </h3>
        {showSplit && !mapLoading && (
          <p className="text-sm text-neutral-500">
            {mapPins.length} on map
            {displayEvents.length > mapPins.length
              ? ` · ${displayEvents.length - mapPins.length} without map location`
              : ""}
          </p>
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
              <div
                className={`grid gap-6 ${showSplit ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
              >
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
            ) : displayEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
                <p className="mt-3 text-lg font-semibold text-neutral-900">No games match your search</p>
                <p className="mt-1 text-sm text-neutral-500">
                  Filters combine together — try widening Where, When, or Sport.
                </p>
                {pendingInviteCount > 0 && onOpenTrips ? (
                  <button
                    type="button"
                    onClick={onOpenTrips}
                    className="mt-5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    You have {pendingInviteCount} invite{pendingInviteCount === 1 ? "" : "s"} in Trips
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className={`grid gap-6 ${showSplit ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}
              >
                {displayEvents.map((event) => {
                  const slotsLeft = Math.max(0, event.officials_needed - (event.booked_count ?? 0));
                  const isSelected = selectedMapId === event.id;
                  const alreadyRequested = event.already_requested || requestedIds.has(event.id);
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
                        ctaLabel={alreadyRequested ? "View request" : "View details"}
                        ctaDisabled={false}
                        ctaLoading={false}
                        onAction={() => setDetailsEvent(event)}
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
                center={wherePlace ? { lat: wherePlace.lat, lng: wherePlace.lng } : null}
                selectedId={selectedMapId}
                onSelect={setSelectedMapId}
                requestedIds={requestedIds}
                requestingId={submittingId}
                onRequest={(event) => void applyToEvent(event)}
              />
            )}
          </div>
        )}
      </div>

      <GameDetailsApplyModal
        event={detailsEvent}
        alreadyRequested={Boolean(
          detailsEvent && (detailsEvent.already_requested || requestedIds.has(detailsEvent.id))
        )}
        requesting={Boolean(detailsEvent && submittingId === detailsEvent.id)}
        onClose={() => setDetailsEvent(null)}
        onApply={(event) => void applyToEvent(event)}
      />
    </div>
  );
}
