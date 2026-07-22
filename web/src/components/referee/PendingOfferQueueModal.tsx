"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEventLocation } from "@/data/sports";

export type PendingOfferQueueItem = {
  id: string;
  offered_pay: number | null;
  message: string | null;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
      }[]
    | null;
};

function eventFromJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function PendingOfferQueueModal({
  offers,
  onRespond,
  onClose,
}: {
  offers: PendingOfferQueueItem[];
  onRespond: (offerId: string, action: "accept" | "decline") => Promise<boolean>;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [queue, setQueue] = useState(offers);

  useEffect(() => {
    setQueue(offers);
    setIndex(0);
  }, [offers]);

  const current = queue[index] ?? null;
  const total = queue.length;
  const event = useMemo(() => eventFromJoin(current?.scheduled_events), [current]);

  if (!current || total === 0) return null;

  async function respond(action: "accept" | "decline") {
    if (!current || busy) return;
    setBusy(true);
    try {
      const ok = await onRespond(current.id, action);
      if (!ok) return;
      setExiting(true);
      window.setTimeout(() => {
        setQueue((prev) => prev.filter((offer) => offer.id !== current.id));
        setIndex(0);
        setExiting(false);
        setBusy(false);
      }, 220);
    } catch {
      setBusy(false);
    }
  }

  const loc = event ? formatEventLocation(event.city, event.state, event.zip_code) : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition ${
          exiting ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--red)]">
              Request {Math.min(index + 1, total)} of {total}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
              {event?.title || "Organizer request"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {[event?.sport, event?.starts_at ? new Date(event.starts_at).toLocaleString() : null, loc]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Exact street address unlocks after you accept.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700"
          >
            Later
          </button>
        </div>

        {current.offered_pay != null && (
          <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900">
            Offered pay ${Number(current.offered_pay).toFixed(0)}
          </p>
        )}
        {current.message && (
          <p className="mt-3 text-sm text-neutral-600">{current.message}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond("decline")}
            className="rounded-full border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-60"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void respond("accept")}
            className="rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}
