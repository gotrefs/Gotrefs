"use client";

import { useEffect, useState } from "react";
import { StarRating } from "@/components/reviews/StarRating";

type LeaveReviewModalProps = {
  open: boolean;
  onClose: () => void;
  subjectLabel: string;
  eventTitle: string;
  eventWhen?: string;
  submitting?: boolean;
  onSubmit: (payload: { score: number; comment: string }) => Promise<void> | void;
  onSkip?: () => Promise<void> | void;
};

/**
 * Airbnb-style leave-review flow:
 * 1) Overall stars
 * 2) Public written review
 * 3) Publish (or skip)
 */
export function LeaveReviewModal({
  open,
  onClose,
  subjectLabel,
  eventTitle,
  eventWhen,
  submitting = false,
  onSubmit,
  onSkip,
}: LeaveReviewModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setStep(1);
      setScore(0);
      setComment("");
      setError(null);
    });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function continueFromStars() {
    setError(null);
    if (score < 1 || score > 5) {
      setError("Tap a star rating to continue.");
      return;
    }
    setStep(2);
  }

  async function publish() {
    setError(null);
    if (score < 1 || score > 5) {
      setError("Choose a star rating.");
      return;
    }
    if (!comment.trim()) {
      setError("Write a short public review — just like Airbnb, reviews need a comment.");
      return;
    }
    try {
      await onSubmit({ score, comment: comment.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish review. Try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-[86] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Step {step} of 2
            </p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-900">Leave a review</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-6">
          <p className="text-sm text-neutral-500">How was your experience with</p>
          <p className="mt-1 text-lg font-semibold text-neutral-900">{subjectLabel}</p>
          <p className="mt-1 text-sm text-neutral-600">
            {eventTitle}
            {eventWhen ? ` · ${eventWhen}` : ""}
          </p>

          {step === 1 ? (
            <div className="mt-8 text-center">
              <p className="text-base font-semibold text-neutral-900">Overall rating</p>
              <div className="mt-4 flex justify-center">
                <StarRating value={score} onChange={setScore} size="lg" />
              </div>
              <p className="mt-3 text-sm text-neutral-500">
                {score === 0
                  ? "Tap a star to rate"
                  : score === 5
                    ? "Amazing"
                    : score === 4
                      ? "Great"
                      : score === 3
                        ? "Good"
                        : score === 2
                          ? "Okay"
                          : "Needs improvement"}
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-4 flex justify-center">
                <StarRating value={score} onChange={setScore} size="md" />
              </div>
              <label className="block text-sm font-semibold text-neutral-900">
                Public review
                <textarea
                  className="mt-2 min-h-32 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-sm text-neutral-800 outline-none transition focus:border-neutral-900"
                  placeholder="Share what stood out — professionalism, punctuality, how they handled the game…"
                  value={comment}
                  maxLength={1000}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                />
              </label>
              <p className="mt-1 text-xs text-neutral-500">{comment.length}/1000 · Visible on their profile</p>
            </div>
          )}

          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-5 py-4">
          {step === 2 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(1)}
              className="text-sm font-semibold text-neutral-700 underline underline-offset-2"
            >
              Back
            </button>
          ) : onSkip ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void onSkip()}
              className="text-sm font-semibold text-neutral-500 hover:text-neutral-800"
            >
              Skip for now
            </button>
          ) : (
            <span />
          )}

          {step === 1 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void continueFromStars()}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void publish()}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {submitting ? "Publishing…" : "Publish review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
