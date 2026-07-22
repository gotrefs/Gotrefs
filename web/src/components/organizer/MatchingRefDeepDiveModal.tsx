"use client";

import { RefReviewsButton } from "@/components/reviews/RefReviewsButton";
import { formatFirstLastInitial } from "@/lib/marketplace/match-refs-for-event";

export type MatchingRefDeepDiveData = {
  id: string;
  gotrefsId: string;
  displayName: string;
  avatarUrl?: string | null;
  primarySport: string;
  additionalSports?: string[];
  certificationLevel?: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  reviews?: Array<{
    score: number;
    comment: string | null;
    createdAt?: string;
    authorLabel?: string;
  }>;
  distanceMiles: number;
  rateLabel: string | null;
  gamesCompleted?: number;
  verified?: boolean;
};

export function MatchingRefDeepDiveModal({
  refData,
  requestSent,
  busy,
  onClose,
  onRequest,
}: {
  refData: MatchingRefDeepDiveData;
  requestSent: boolean;
  busy: boolean;
  onClose: () => void;
  onRequest: () => void;
}) {
  const name = formatFirstLastInitial(refData.displayName);
  const sports = [refData.primarySport, ...(refData.additionalSports ?? [])].filter(Boolean);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--red)]">Referee profile</p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-900">{name}</h2>
            <p className="mt-1 text-sm text-neutral-500">ID {refData.gotrefsId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-neutral-100">
            {refData.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={refData.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-black text-neutral-600">
                {initials}
              </div>
            )}
          </div>
          <div>
            {refData.verified !== false && (
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Verified official
              </span>
            )}
            {refData.certificationLevel && (
              <p className="mt-2 text-sm font-semibold text-neutral-800">{refData.certificationLevel}</p>
            )}
            <p className="mt-1 text-sm text-neutral-500">{refData.distanceMiles.toFixed(1)} miles from event</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rate</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{refData.rateLabel || "Rate TBD"}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Games completed</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{refData.gamesCompleted ?? 0}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sports officiated</p>
          <p className="mt-2 text-sm font-medium text-neutral-800">{sports.join(" · ") || "—"}</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Host ratings</p>
          <div className="mt-2">
            <RefReviewsButton
              refMemberId={refData.id}
              title={name}
              average={refData.ratingAverage}
              count={refData.ratingCount}
              emptyLabel="No reviews yet"
            />
          </div>
          {(refData.reviews ?? []).slice(0, 3).length > 0 && (
            <ul className="mt-3 space-y-2">
              {(refData.reviews ?? []).slice(0, 3).map((review, index) => (
                <li key={`${review.createdAt ?? index}`} className="rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-neutral-800">
                    {review.score.toFixed(1)} ★ · {review.authorLabel || "Host"}
                  </p>
                  {review.comment && <p className="mt-1 text-neutral-600">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          disabled={requestSent || busy}
          onClick={onRequest}
          className="mt-6 w-full rounded-full bg-[var(--red)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--red-dark)] disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {requestSent ? "Request Sent" : busy ? "Sending…" : "Request Referee"}
        </button>
      </div>
    </div>
  );
}
