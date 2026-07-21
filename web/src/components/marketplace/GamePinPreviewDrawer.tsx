"use client";

import { useEffect } from "react";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
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
  // Exact offers read as a game total on browse; ranges keep the /game unit.
  if (type !== "range") return label.replace(/\/game$/, " total");
  return label;
}

export function GamePinPreviewDrawer({
  event,
  alreadyRequested,
  requesting,
  onClose,
  onApply,
}: {
  event: OpenEventRecord | null;
  alreadyRequested?: boolean;
  requesting?: boolean;
  onClose: () => void;
  onApply: (event: OpenEventRecord) => void;
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
  const ctaLabel = requested
    ? "Requested to work"
    : requesting
      ? "Requesting…"
      : "View Details & Apply";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center sm:items-end sm:justify-end sm:p-4">
      <button
        type="button"
        aria-label="Dismiss game preview"
        className="pointer-events-auto absolute inset-0 bg-black/25 sm:bg-transparent"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={`pin-preview-title-${event.id}`}
        className="pointer-events-auto relative w-full max-w-md translate-y-0 rounded-t-2xl border border-neutral-200 bg-white shadow-2xl transition-transform duration-200 ease-out sm:mb-0 sm:rounded-2xl"
      >
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {event.sport}
              </p>
              <h3
                id={`pin-preview-title-${event.id}`}
                className="text-lg font-semibold leading-snug text-neutral-900"
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

          <dl className="space-y-2 text-sm">
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
          </dl>

          <button
            type="button"
            disabled={requested || requesting}
            onClick={() => onApply(event)}
            className={`mt-1 w-full rounded-xl py-3 text-sm font-semibold text-white transition ${
              requested
                ? "cursor-default bg-emerald-600"
                : "bg-[#d81d24] hover:bg-[#c01820] disabled:opacity-60"
            }`}
          >
            {ctaLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}
