"use client";

import { useState } from "react";
import { RefereeIdCard } from "@/components/RefereeIdCard";

export type ApplicantReviewData = {
  id: string;
  eventId: string;
  refMemberId: string;
  gotrefsId: string;
  displayName?: string | null;
  primarySport?: string | null;
  additionalSports?: string[];
  certificationLevel?: string | null;
  avatarUrl?: string | null;
  eventTitle: string;
  eventPlace?: string | null;
  eventWhen?: string | null;
  eventPayLabel: string | null;
  refRateLabel: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  reviews: Array<{
    score: number;
    comment: string | null;
    createdAt: string;
    authorLabel?: string | null;
  }>;
};

export function ApplicantReviewModal({
  applicant,
  onClose,
  onDecide,
}: {
  applicant: ApplicantReviewData;
  onClose: () => void;
  onDecide: (action: "accept" | "withdraw") => Promise<boolean | string>;
}) {
  const [busy, setBusy] = useState<"accept" | "withdraw" | null>(null);
  const [done, setDone] = useState<"accept" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeny, setConfirmDeny] = useState(false);

  async function decide(action: "accept" | "withdraw") {
    setBusy(action);
    setError(null);
    try {
      const result = await onDecide(action);
      if (result !== true) {
        setError(
          typeof result === "string"
            ? result
            : action === "accept"
              ? "Could not approve this ref. Try again."
              : "Could not deny this request. Try again."
        );
        setConfirmDeny(false);
        return;
      }
      setDone(action);
      window.setTimeout(() => onClose(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your decision. Try again.");
      setConfirmDeny(false);
    } finally {
      setBusy(null);
    }
  }

  const name = `Ref ${applicant.gotrefsId}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
      >
        {done ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
                done === "accept" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              ✓
            </div>
            <p className="mt-4 text-xl font-bold text-neutral-900">
              {done === "accept" ? "Approved" : "Request denied"}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {done === "accept"
                ? "The ref will see this game under Upcoming with the full address."
                : "This request was removed. The ref can request again if the game is still open."}
            </p>
          </div>
        ) : confirmDeny ? (
          <div className="py-6 text-center sm:py-8">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Confirm</p>
            <h2 className="mt-2 text-xl font-bold text-neutral-900">Are you sure?</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-600">
              Deny <span className="font-semibold text-neutral-900">Ref {applicant.gotrefsId}</span> for{" "}
              <span className="font-semibold text-neutral-900">{applicant.eventTitle}</span>? They will be
              notified and won’t stay on this request.
            </p>
            {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setConfirmDeny(false);
                  setError(null);
                }}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide("withdraw")}
                className="rounded-xl bg-[var(--red)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy === "withdraw" ? "Denying…" : "Yes, deny"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
                  Ref requested for your event
                </p>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">{applicant.eventTitle}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {[applicant.eventPlace, applicant.eventWhen].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-800">Ref {applicant.gotrefsId}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm font-semibold text-neutral-600"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <RefereeIdCard
                fullName={name}
                gotrefsId={applicant.gotrefsId}
                primarySport={applicant.primarySport ?? undefined}
                additionalSports={applicant.additionalSports ?? []}
                certificationLevel={applicant.certificationLevel ?? undefined}
                rate={applicant.refRateLabel?.replace(/^\$/, "").replace(/\/.*/, "") ?? undefined}
                avatarUrl={applicant.avatarUrl ?? undefined}
                profileComplete
                verificationStatus="approved"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-neutral-900">
                  {applicant.ratingAverage != null
                    ? `${applicant.ratingAverage} ★ · ${applicant.ratingCount} review${applicant.ratingCount === 1 ? "" : "s"}`
                    : "No reviews yet"}
                </p>
                <p className="text-sm font-semibold text-neutral-800">
                  {applicant.eventPayLabel
                    ? `Event pay ${applicant.eventPayLabel}`
                    : applicant.refRateLabel
                      ? `Ref rate ${applicant.refRateLabel}`
                      : "Pay TBD"}
                </p>
              </div>
              {applicant.reviews.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {applicant.reviews.slice(0, 4).map((review, index) => (
                    <li key={`${review.createdAt}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm">
                      <p className="font-semibold text-neutral-900">
                        {"★".repeat(Math.max(1, Math.round(review.score)))}
                        <span className="ml-2 font-medium text-neutral-500">Host</span>
                      </p>
                      {review.comment ? (
                        <p className="mt-1 text-neutral-600">{review.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">New on GotRefs — no host reviews yet.</p>
              )}
            </div>

            {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setError(null);
                  setConfirmDeny(true);
                }}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-800 disabled:opacity-60"
              >
                Deny
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide("accept")}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy === "accept" ? "Approving…" : "Approve"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
