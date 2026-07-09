"use client";

import { ListingPhotoCarousel } from "@/components/marketplace/ListingPhotoCarousel";
import { marketplaceCardShadow, refListingPhotos, sportListingVisual } from "@/lib/marketplace/airbnb-styles";

export function RefListingCard({
  gotrefsId,
  primarySport,
  rateLabel,
  ratingAverage,
  ratingCount,
  reviewSnippet,
  availabilityLabel,
  priceFits,
  onInvite,
  onMessage,
  inviteDisabled,
  inviteLabel = "Invite",
}: {
  gotrefsId: string;
  primarySport: string;
  rateLabel: string;
  ratingAverage: number | null;
  ratingCount: number;
  reviewSnippet?: string | null;
  availabilityLabel: string;
  priceFits?: boolean;
  onInvite: () => void;
  onMessage?: () => void;
  inviteDisabled?: boolean;
  inviteLabel?: string;
}) {
  const visual = sportListingVisual(primarySport);
  const photos = refListingPhotos(primarySport);
  const stars =
    ratingAverage != null && ratingCount > 0 ? `★ ${ratingAverage.toFixed(1)}` : "New";

  return (
    <article className={`overflow-hidden rounded-xl bg-white transition duration-300 ${marketplaceCardShadow}`}>
      <div className="relative">
        <ListingPhotoCarousel
          images={photos}
          alt={`Verified ${primarySport} official ${gotrefsId}`}
          gradientClass={visual.gradient}
          emoji={visual.emoji}
          badge="Verified"
          aspectClass="aspect-[5/3]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-3">
          <p className="rounded-full bg-black/45 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
            Official {gotrefsId}
          </p>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900">{primarySport} official</p>
            <p className="text-sm text-neutral-500">
              {stars}
              {ratingCount > 0 ? ` · ${ratingCount} review${ratingCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <p className="shrink-0 text-[15px] font-semibold text-neutral-900">{rateLabel}</p>
        </div>

        {reviewSnippet && (
          <p className="line-clamp-2 text-sm text-neutral-600">&ldquo;{reviewSnippet}&rdquo;</p>
        )}

        <p className="text-xs text-neutral-500">{availabilityLabel}</p>

        {priceFits === false && (
          <p className="text-xs font-medium text-amber-700">Pay range does not overlap this event.</p>
        )}

        <div className="flex gap-2 pt-1">
          {onMessage && (
            <button
              type="button"
              onClick={onMessage}
              className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Message
            </button>
          )}
          <button
            type="button"
            disabled={inviteDisabled}
            onClick={onInvite}
            className="flex-1 rounded-lg bg-[var(--red)] py-2 text-sm font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-50"
          >
            {inviteLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
