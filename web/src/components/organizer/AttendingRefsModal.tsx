"use client";

import { useEffect, useState } from "react";
import { RefereeIdCard } from "@/components/RefereeIdCard";

export type AttendingRef = {
  offerId: string;
  refMemberId: string;
  gotrefsId: string;
  primarySport?: string | null;
  additionalSports?: string[];
  certificationLevel?: string | null;
  avatarUrl?: string | null;
  offeredPay?: number | null;
};

export function AttendingRefsModal({
  eventTitle,
  eventWhen,
  refs,
  onClose,
  initialOfferId = null,
}: {
  eventTitle: string;
  eventWhen?: string | null;
  refs: AttendingRef[];
  onClose: () => void;
  /** When set, open directly on that official’s ID card. */
  initialOfferId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (initialOfferId && refs.some((ref) => ref.offerId === initialOfferId)) {
      return initialOfferId;
    }
    // Single-ref deep link (e.g. Messages → accepted official): skip the list.
    if (refs.length === 1) return refs[0].offerId;
    return null;
  });
  const selected = refs.find((ref) => ref.offerId === selectedId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedId && refs.length > 1) setSelectedId(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selectedId, refs.length]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" aria-label="Dismiss" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
      >
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
                  Official ID
                </p>
                <h2 className="mt-1 truncate text-xl font-bold text-neutral-900">
                  Ref {selected.gotrefsId}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">{eventTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (refs.length <= 1) onClose();
                  else setSelectedId(null);
                }}
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                {refs.length <= 1 ? "Close" : "Back"}
              </button>
            </div>

            <div className="mt-5">
              <RefereeIdCard
                fullName={`Ref ${selected.gotrefsId}`}
                gotrefsId={selected.gotrefsId}
                primarySport={selected.primarySport ?? undefined}
                additionalSports={selected.additionalSports ?? []}
                certificationLevel={selected.certificationLevel ?? undefined}
                rate={
                  selected.offeredPay != null && Number.isFinite(selected.offeredPay)
                    ? String(selected.offeredPay)
                    : undefined
                }
                avatarUrl={selected.avatarUrl ?? undefined}
                profileComplete
                verificationStatus="approved"
                hideQr
              />
            </div>

            <p className="mt-4 text-center text-xs text-neutral-500">
              {refs.length > 1
                ? "Tap Back to return to the attending list and open another official."
                : "This is the official’s GotRefs ID for your event."}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
                  Attending officials
                </p>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">{eventTitle}</h2>
                {eventWhen ? <p className="mt-1 text-sm text-neutral-500">{eventWhen}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            {refs.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                No officials are confirmed for this game yet.
              </p>
            ) : (
              <ul className="mt-5 space-y-2">
                {refs.map((ref) => (
                  <li key={ref.offerId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ref.offerId)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-sm font-bold text-neutral-700">
                        {ref.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ref.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          ref.gotrefsId.slice(-2)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-neutral-900">
                          Ref {ref.gotrefsId}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-neutral-500">
                          {[ref.primarySport, ref.offeredPay != null ? `$${ref.offeredPay}` : null]
                            .filter(Boolean)
                            .join(" · ") || "Confirmed official"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-neutral-400" aria-hidden>
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
