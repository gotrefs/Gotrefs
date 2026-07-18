"use client";

import { useEffect } from "react";
import { StarRating } from "@/components/reviews/StarRating";

export type PublicReview = {
  id?: string;
  score: number;
  comment: string | null;
  createdAt: string;
  authorLabel: string;
  eventTitle?: string | null;
};

export function ReviewsModal({
  open,
  onClose,
  title,
  average,
  count,
  reviews,
  emptyLabel = "No reviews yet",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  average: number | null;
  count: number;
  reviews: PublicReview[];
  emptyLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close reviews" onClick={onClose} />
      <div className="relative z-[81] flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Reviews</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h2>
            {count > 0 && average != null ? (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={average} size="sm" readOnly />
                <span className="text-sm font-semibold text-neutral-800">
                  {average.toFixed(2)} · {count} review{count === 1 ? "" : "s"}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">{emptyLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-500">{emptyLabel}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {reviews.map((review, index) => (
                <li key={review.id ?? `${review.createdAt}-${index}`} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-base font-semibold text-neutral-700">
                    {(review.authorLabel || "H").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-neutral-900">{review.authorLabel || "Host"}</p>
                      <span className="text-neutral-300">·</span>
                      <p className="text-sm text-neutral-500">
                        {new Date(review.createdAt).toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="mt-1">
                      <StarRating value={review.score} size="sm" readOnly />
                    </div>
                    {review.eventTitle ? (
                      <p className="mt-1 text-xs font-medium text-neutral-500">{review.eventTitle}</p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                      {review.comment?.trim() || "No written comment."}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
