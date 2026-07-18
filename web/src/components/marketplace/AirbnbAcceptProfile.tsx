"use client";

import { ListingPhotoCarousel } from "@/components/marketplace/ListingPhotoCarousel";
import { RefReviewsButton } from "@/components/reviews/RefReviewsButton";
import {
  marketplaceCardShadow,
  refListingPhotos,
  sportListingPhotos,
  sportListingVisual,
} from "@/lib/marketplace/airbnb-styles";

export type AirbnbAcceptReview = {
  id?: string;
  score: number;
  comment: string | null;
  createdAt?: string;
  authorLabel?: string;
  eventTitle?: string | null;
};

export function AirbnbAcceptProfile({
  photoUrls,
  photoAlt,
  sportForVisual = "Basketball",
  eyebrow,
  title,
  subtitle,
  refMemberId,
  ratingAverage,
  ratingCount,
  reviewsTitle = "Reviews from hosts",
  reviews,
  emptyReviewsLabel = "New — no reviews yet",
  metaRows,
  message,
  primaryLabel,
  secondaryLabel = "Decline",
  onPrimary,
  onSecondary,
  busy = false,
}: {
  photoUrls: string[];
  photoAlt: string;
  sportForVisual?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  refMemberId?: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  reviewsTitle?: string;
  reviews?: AirbnbAcceptReview[];
  emptyReviewsLabel?: string;
  metaRows?: string[];
  message?: string | null;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  busy?: boolean;
}) {
  const count = ratingCount ?? 0;
  const reviewList = reviews ?? [];
  const visual = sportListingVisual(sportForVisual);
  const publicReviews = reviewList.map((review) => ({
    id: review.id,
    score: review.score,
    comment: review.comment,
    createdAt: review.createdAt ?? "",
    authorLabel: review.authorLabel ?? "Host",
    eventTitle: review.eventTitle ?? null,
  }));

  return (
    <article className={`overflow-hidden rounded-2xl bg-white ${marketplaceCardShadow}`}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="relative bg-neutral-100">
          <ListingPhotoCarousel
            images={photoUrls}
            alt={photoAlt}
            gradientClass={visual.gradient}
            emoji={visual.emoji}
            aspectClass="aspect-[4/3] lg:aspect-auto lg:min-h-[320px] lg:h-full"
          />
        </div>

        <div className="flex flex-col p-5 sm:p-7">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{eyebrow}</p>
          ) : null}
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            {refMemberId ? (
              <RefReviewsButton
                refMemberId={refMemberId}
                title={title}
                average={ratingAverage}
                count={count}
                initialReviews={publicReviews}
                emptyLabel={emptyReviewsLabel}
              />
            ) : count > 0 && ratingAverage != null ? (
              <span className="font-semibold">
                ★ {ratingAverage.toFixed(2)} · {count} review{count === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {emptyReviewsLabel}
              </span>
            )}
          </div>

          {metaRows && metaRows.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-neutral-600">
              {metaRows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          ) : null}

          {message?.trim() ? (
            <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{message}</p>
          ) : null}

          <div className="mt-6 border-t border-neutral-200 pt-5">
            <p className="text-base font-semibold text-neutral-900">
              {reviewsTitle}
              {reviewList.length > 0 ? ` (${reviewList.length})` : ""}
            </p>
            {reviewList.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">{emptyReviewsLabel}</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviewList.map((review, index) => (
                  <li key={`${review.createdAt ?? index}-${review.score}`} className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">
                      {(review.authorLabel ?? "H").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">
                        {review.authorLabel ?? "Host"} · {"★".repeat(Math.max(1, Math.min(5, review.score)))}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-neutral-700">
                        {review.comment?.trim() || "No written comment."}
                      </p>
                      {review.createdAt ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(review.createdAt).toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <button
              type="button"
              disabled={busy}
              onClick={onPrimary}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy ? "Saving…" : primaryLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSecondary}
              className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function acceptPhotosForSport(sport: string, preferredUrl?: string | null) {
  const fallback = sportListingPhotos(sport);
  if (preferredUrl?.trim()) return [preferredUrl.trim(), ...fallback];
  return refListingPhotos(sport);
}
