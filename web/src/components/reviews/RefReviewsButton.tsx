"use client";

import { useState } from "react";
import { RatingSummaryButton } from "@/components/reviews/StarRating";
import { ReviewsModal, type PublicReview } from "@/components/reviews/ReviewsModal";

type RefReviewsButtonProps = {
  refMemberId: string;
  title: string;
  average: number | null | undefined;
  count: number;
  initialReviews?: PublicReview[];
  emptyLabel?: string;
  className?: string;
};

/** Airbnb-style ★ summary that opens the full reviews modal on click. */
export function RefReviewsButton({
  refMemberId,
  title,
  average,
  count,
  initialReviews = [],
  emptyLabel = "New",
  className = "",
}: RefReviewsButtonProps) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<PublicReview[]>(initialReviews);
  const [modalAverage, setModalAverage] = useState(average ?? null);
  const [modalCount, setModalCount] = useState(count);
  const [loading, setLoading] = useState(false);

  async function openReviews() {
    if (count <= 0 || average == null) return;
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/ratings?refMemberId=${encodeURIComponent(refMemberId)}`);
      const json = (await res.json()) as {
        average?: number | null;
        count?: number;
        reviews?: PublicReview[];
        error?: string;
      };
      if (res.ok) {
        setModalAverage(json.average ?? average ?? null);
        setModalCount(json.count ?? count);
        setReviews(json.reviews ?? initialReviews);
      }
    } catch {
      setReviews(initialReviews);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RatingSummaryButton
        average={average}
        count={count}
        onClick={count > 0 && average != null ? () => void openReviews() : undefined}
        emptyLabel={emptyLabel}
        className={className}
      />
      <ReviewsModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        average={modalAverage}
        count={modalCount}
        reviews={reviews}
        emptyLabel={loading ? "Loading reviews…" : "No reviews yet"}
      />
    </>
  );
}
