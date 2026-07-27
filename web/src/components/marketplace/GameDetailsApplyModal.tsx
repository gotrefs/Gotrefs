"use client";

import { useEffect } from "react";
import { isEventOpenForRequests, type OpenEventRecord } from "@/lib/marketplace/event-filters";
import { notesForRefDisplay } from "@/lib/marketplace/notes-for-ref";
import { EVENT_PRIVACY_RADIUS_MILES } from "@/lib/maps/geo";
import { formatPayRangeLabel } from "@/lib/pay-range";

function formatEventSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return "Schedule TBD";

  const datePart = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startTime = start.toLocaleTimeString(undefined, timeOpts);
  if (Number.isNaN(end.getTime())) return `${datePart} • ${startTime}`;
  const endTime = end.toLocaleTimeString(undefined, timeOpts);
  return `${datePart} • ${startTime} - ${endTime}`;
}

function formatGeneralLocation(event: OpenEventRecord) {
  const place = [event.city, event.state].filter(Boolean).join(", ");
  const area = `~${EVENT_PRIVACY_RADIUS_MILES} mi area`;
  if (place) return `${place} (${area})`;
  return `Approximate location (${area})`;
}

function formatEstCompensation(event: OpenEventRecord) {
  const type = event.pay_type === "range" ? "range" : "exact";
  const label = formatPayRangeLabel({
    type,
    exact: event.pay_offer,
    min: event.pay_min,
    max: event.pay_max,
    unit: "game",
  });
  if (!label) return "Pay TBD";
  if (type !== "range") return label.replace(/\/game$/, " total");
  return label;
}

export function GameDetailsApplyModal({
  event,
  alreadyRequested,
  requesting,
  unrequesting,
  onClose,
  onApply,
  onUnrequest,
}: {
  event: OpenEventRecord | null;
  alreadyRequested?: boolean;
  requesting?: boolean;
  unrequesting?: boolean;
  onClose: () => void;
  onApply: (event: OpenEventRecord) => void;
  onUnrequest?: (event: OpenEventRecord) => void;
}) {
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;

  const requested = Boolean(alreadyRequested);
  const ended = !isEventOpenForRequests(event);
  const slotsLeft = Math.max(0, event.officials_needed - (event.booked_count ?? 0));
  const busy = Boolean(requesting || unrequesting);
  const applyLabel = ended
    ? "Game ended"
    : requesting
      ? "Submitting…"
      : "Apply";
  const notes = notesForRefDisplay(event.notes);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" aria-label="Dismiss" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`game-details-title-${event.id}`}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {event.sport}
              </p>
              <h3
                id={`game-details-title-${event.id}`}
                className="text-xl font-semibold leading-snug text-neutral-900"
              >
                {event.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Time & Date
              </dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {formatEventSchedule(event.starts_at, event.ends_at)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                General Location
              </dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{formatGeneralLocation(event)}</dd>
              <dd className="mt-0.5 text-xs text-neutral-500">
                Exact address shown after you request and the organizer confirms.
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Est. Compensation
              </dt>
              <dd className="mt-0.5 text-base font-semibold text-neutral-900">
                {formatEstCompensation(event)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Openings
              </dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {slotsLeft} official slot{slotsLeft === 1 ? "" : "s"} available
              </dd>
            </div>
            {notes ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Notes
                </dt>
                <dd className="mt-0.5 text-neutral-700">{notes}</dd>
              </div>
            ) : null}
          </dl>

          {requested ? (
            <div className="space-y-2">
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800">
                Requested to work
              </p>
              <button
                type="button"
                disabled={busy || !onUnrequest}
                onClick={() => onUnrequest?.(event)}
                className="w-full rounded-xl border border-neutral-300 bg-white py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-60"
              >
                {unrequesting ? "Unrequesting…" : "Unrequest"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={ended || busy || slotsLeft === 0}
              onClick={() => onApply(event)}
              className="mt-1 w-full rounded-xl bg-[#d81d24] py-3 text-sm font-semibold text-white transition hover:bg-[#c01820] disabled:opacity-60"
            >
              {ended ? "Game ended" : slotsLeft === 0 ? "No openings left" : applyLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
