"use client";

import { useEffect, useMemo, useState } from "react";
import { EventMatchingMap } from "@/components/organizer/EventMatchingMap";
import { MatchingRefDeepDiveModal } from "@/components/organizer/MatchingRefDeepDiveModal";
import { MatchingRefSummaryCard } from "@/components/organizer/MatchingRefSummaryCard";
import { RequestSentSuccessModal } from "@/components/organizer/RequestSentSuccessModal";
import {
  formatFirstLastInitial,
  matchRefsForEvent,
  type MatchedRef,
} from "@/lib/marketplace/match-refs-for-event";
import { formatPayOffer } from "@/data/sports";

const EMPTY_REF_IDS = new Set<string>();

export type MatchingEvent = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  city?: string | null;
  state?: string | null;
};

export type MatchingDirectoryRef = {
  id: string;
  gotrefsId: string;
  displayName: string;
  primarySport: string;
  additionalSports?: string[];
  certificationLevel?: string | null;
  avatarUrl?: string | null;
  ratePerGame: number | null;
  rateType?: "exact" | "range" | null;
  rateMin?: number | null;
  rateMax?: number | null;
  rateUnit?: "hour" | "game" | null;
  homeZip: string | null;
  travelRadiusMiles?: number | null;
  availability: { start_at: string; end_at: string }[];
  ratingAverage: number | null;
  ratingCount: number;
  reviews?: Array<{
    score: number;
    comment: string | null;
    createdAt?: string;
    authorLabel?: string;
  }>;
  gamesCompleted?: number;
};

function formatRateLabel(ref: MatchingDirectoryRef) {
  const unit = ref.rateUnit === "game" ? "game" : "hr";
  if (ref.rateType === "range") {
    const min = ref.rateMin ?? ref.ratePerGame;
    const max = ref.rateMax;
    if (min != null && max != null) return `$${Number(min).toFixed(0)}–$${Number(max).toFixed(0)}/${unit}`;
    if (min != null) return `$${Number(min).toFixed(0)}+/${unit}`;
  }
  return ref.ratePerGame != null ? `$${Number(ref.ratePerGame).toFixed(0)}/${unit}` : null;
}

export function EventMatchingView({
  event,
  refs,
  hiredCount,
  pendingRefIds,
  excludeRefIds,
  onBackToListings,
  onRequestRef,
}: {
  event: MatchingEvent;
  refs: MatchingDirectoryRef[];
  hiredCount: number;
  pendingRefIds: Set<string>;
  excludeRefIds?: Set<string>;
  onBackToListings: () => void;
  onRequestRef: (refId: string) => Promise<boolean>;
}) {
  const [eventCoords, setEventCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [matches, setMatches] = useState<MatchedRef<MatchingDirectoryRef>[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deepDiveId, setDeepDiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState<Set<string>>(() => new Set(pendingRefIds));
  const [successRefId, setSuccessRefId] = useState<string | null>(null);
  const excludeKey = useMemo(
    () => Array.from(excludeRefIds ?? EMPTY_REF_IDS).sort().join("|"),
    [excludeRefIds]
  );
  const pendingKey = useMemo(() => Array.from(pendingRefIds).sort().join("|"), [pendingRefIds]);
  const excluded = useMemo(
    () => new Set(excludeKey ? excludeKey.split("|") : []),
    [excludeKey]
  );

  useEffect(() => {
    setLocalPending(new Set(pendingKey ? pendingKey.split("|") : []));
  }, [pendingKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMatches(true);
    void matchRefsForEvent(event, refs, {
      excludeIds: excluded,
      requireAvailability: false,
    }).then((result) => {
      if (cancelled) return;
      setEventCoords(result.eventCoords);
      setMatches(result.matches);
      setLoadingMatches(false);
    });
    return () => {
      cancelled = true;
    };
  }, [event, refs, excluded]);

  const selectedMatch = useMemo(
    () => matches.find((ref) => ref.id === selectedId) ?? null,
    [matches, selectedId]
  );
  const deepDiveMatch = useMemo(
    () => matches.find((ref) => ref.id === deepDiveId) ?? null,
    [matches, deepDiveId]
  );
  const successMatch = useMemo(
    () => matches.find((ref) => ref.id === successRefId) ?? null,
    [matches, successRefId]
  );

  const payLabel = formatPayOffer(event.pay_offer);
  const statusLabel = `${hiredCount}/${event.officials_needed} Refs Hired`;

  async function requestRef(refId: string) {
    setBusyId(refId);
    try {
      const ok = await onRequestRef(refId);
      if (!ok) return;
      setLocalPending((prev) => new Set(prev).add(refId));
      setSuccessRefId(refId);
      setDeepDiveId(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--red)]">Event matching</p>
            <h1 className="truncate text-xl font-semibold text-neutral-900 sm:text-2xl">{event.title}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {event.sport} · {new Date(event.starts_at).toLocaleString()}
              {payLabel ? ` · ${payLabel}` : ""} · {statusLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToListings}
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            ← Back to listings
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-[90rem] flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-neutral-200 p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Matching refs</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Verified officials whose travel radius reaches this event.
            </p>
          </div>
          {loadingMatches ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-36 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-500">
              No matching refs found for this sport and location yet. Check back as more verified officials add availability nearby.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((ref) => (
                <MatchingRefSummaryCard
                  key={ref.id}
                  refData={{
                    id: ref.id,
                    displayName: ref.displayName,
                    avatarUrl: ref.avatarUrl,
                    ratingAverage: ref.ratingAverage,
                    ratingCount: ref.ratingCount,
                    distanceMiles: ref.distanceMiles,
                    rateLabel: formatRateLabel(ref),
                    rateUnit: ref.rateUnit,
                  }}
                  selected={selectedId === ref.id}
                  requestSent={localPending.has(ref.id)}
                  onViewProfile={() => {
                    setSelectedId(ref.id);
                    setDeepDiveId(ref.id);
                  }}
                />
              ))}
            </div>
          )}
          {selectedMatch && !deepDiveId && (
            <p className="mt-4 text-xs text-neutral-500">
              Selected on map: {formatFirstLastInitial(selectedMatch.displayName)}
            </p>
          )}
        </aside>

        <section className="min-h-[24rem] p-4 sm:p-5">
          <EventMatchingMap
            eventCenter={eventCoords}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setDeepDiveId(id);
            }}
            refs={matches.map((ref) => ({
              id: ref.id,
              label: formatFirstLastInitial(ref.displayName),
              lat: ref.coords.lat,
              lng: ref.coords.lng,
              travelRadiusMiles: ref.travelRadiusMiles,
            }))}
            className="h-full min-h-[24rem] w-full lg:min-h-0"
          />
        </section>
      </div>

      {deepDiveMatch && (
        <MatchingRefDeepDiveModal
          refData={{
            id: deepDiveMatch.id,
            gotrefsId: deepDiveMatch.gotrefsId,
            displayName: deepDiveMatch.displayName,
            avatarUrl: deepDiveMatch.avatarUrl,
            primarySport: deepDiveMatch.primarySport,
            additionalSports: deepDiveMatch.additionalSports,
            certificationLevel: deepDiveMatch.certificationLevel,
            ratingAverage: deepDiveMatch.ratingAverage,
            ratingCount: deepDiveMatch.ratingCount,
            reviews: deepDiveMatch.reviews,
            distanceMiles: deepDiveMatch.distanceMiles,
            rateLabel: formatRateLabel(deepDiveMatch),
            gamesCompleted: deepDiveMatch.gamesCompleted ?? 0,
            verified: true,
          }}
          requestSent={localPending.has(deepDiveMatch.id)}
          busy={busyId === deepDiveMatch.id}
          onClose={() => setDeepDiveId(null)}
          onRequest={() => void requestRef(deepDiveMatch.id)}
        />
      )}

      {successMatch && (
        <RequestSentSuccessModal
          refLabel={formatFirstLastInitial(successMatch.displayName)}
          onGoToNextEvent={() => {
            setSuccessRefId(null);
            onBackToListings();
          }}
          onStay={() => setSuccessRefId(null)}
        />
      )}
    </div>
  );
}
