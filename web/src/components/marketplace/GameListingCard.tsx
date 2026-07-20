"use client";

import { formatEventLocation } from "@/data/sports";
import { ListingPhotoCarousel } from "@/components/marketplace/ListingPhotoCarousel";
import { applyBoostToPay, totalBoostPercent } from "@/lib/boosts";
import { marketplaceCardShadow, sportListingVisual } from "@/lib/marketplace/airbnb-styles";
import type { OpenEventRecord } from "@/lib/marketplace/event-filters";
import { formatPayRangeLabel } from "@/lib/pay-range";

function formatEventPay(event: OpenEventRecord, boostPercent = 0) {
  const boosted = (value: number | null | undefined) =>
    value != null && boostPercent > 0 ? applyBoostToPay(value, boostPercent) : value;
  return (
    formatPayRangeLabel({
      type: event.pay_type === "range" ? "range" : "exact",
      exact: boosted(event.pay_offer),
      min: boosted(event.pay_min),
      max: boosted(event.pay_max),
      unit: "hour",
    }) ?? "Pay TBD"
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GameListingCard({
  event,
  payBadge,
  slotsLeft,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onAction,
}: {
  event: OpenEventRecord;
  payBadge?: string | null;
  slotsLeft: number;
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onAction: () => void;
}) {
  const visual = sportListingVisual(event.sport);
  const loc = formatEventLocation(event.city, event.state, event.zip_code) || `ZIP ${event.zip_code}`;
  const activeBoosts = event.active_boosts ?? [];
  const boostPercent = totalBoostPercent(activeBoosts);

  return (
    <article className="group cursor-pointer" onClick={() => !ctaDisabled && onAction()}>
      <div className={`overflow-hidden rounded-xl bg-white transition duration-300 ${marketplaceCardShadow}`}>
        <div className="relative">
          <ListingPhotoCarousel
            images={visual.photos}
            alt={`${event.sport} game at ${event.title}`}
            gradientClass={visual.gradient}
            emoji={visual.emoji}
            badge={event.sport}
            secondaryBadge={
              payBadge
                ? payBadge.includes("outside")
                  ? "Rate mismatch"
                  : "Rate match"
                : null
            }
          />
          {slotsLeft <= 2 && slotsLeft > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-neutral-900/80 px-2 py-1 text-[11px] font-semibold text-white">
              Only {slotsLeft} left
            </div>
          )}
        </div>

        <div className="space-y-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-[15px] font-semibold text-neutral-900">{event.title}</h3>
            <span className="shrink-0 text-right text-[15px] font-semibold text-neutral-900">
              {boostPercent > 0 && (
                <span className="mr-1.5 text-sm font-normal text-neutral-400 line-through">
                  {formatEventPay(event)}
                </span>
              )}
              {formatEventPay(event, boostPercent)}
            </span>
          </div>
          {boostPercent > 0 && (
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">
                +{boostPercent}% boost
              </span>
              <span className="text-[11px] text-neutral-500">
                {activeBoosts.map((boost) => boost.title).join(" · ")}
              </span>
            </p>
          )}
          <p className="line-clamp-1 text-sm text-neutral-500">{loc}</p>
          <p className="text-sm text-neutral-500">{formatShortDate(event.starts_at)}</p>
          <p className="pt-1 text-xs text-neutral-400">
            {slotsLeft} official slot{slotsLeft === 1 ? "" : "s"} · Open to requests
          </p>
          <button
            type="button"
            disabled={ctaDisabled || ctaLoading}
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className="mt-2 w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ctaLoading ? "Requesting…" : ctaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
