"use client";

import { formatFirstLastInitial } from "@/lib/marketplace/match-refs-for-event";

export type MatchingRefCardData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  distanceMiles: number;
  rateLabel: string | null;
  rateUnit?: "hour" | "game" | null;
};

export function MatchingRefSummaryCard({
  refData,
  selected,
  requestSent,
  onViewProfile,
}: {
  refData: MatchingRefCardData;
  selected?: boolean;
  requestSent?: boolean;
  onViewProfile: () => void;
}) {
  const name = formatFirstLastInitial(refData.displayName);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rating =
    refData.ratingAverage != null
      ? `${refData.ratingAverage.toFixed(1)} ★ (${refData.ratingCount})`
      : "New · no reviews";
  const rate =
    refData.rateLabel ||
    (refData.rateUnit === "game" ? "Game rate TBD" : "Hourly rate TBD");

  return (
    <article
      className={`rounded-2xl border bg-white p-4 transition ${
        selected ? "border-neutral-900 shadow-md" : "border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-100">
          {refData.avatarUrl ? (
            // Signed/OAuth URLs are ephemeral.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={refData.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-black text-neutral-600">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-neutral-900">{name}</p>
          <p className="mt-0.5 text-sm text-neutral-600">{rating}</p>
          <p className="mt-0.5 text-sm text-neutral-500">{refData.distanceMiles.toFixed(1)} miles away</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{rate}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onViewProfile}
        disabled={requestSent}
        className="mt-3 w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {requestSent ? "Request Sent" : "View Profile"}
      </button>
    </article>
  );
}
