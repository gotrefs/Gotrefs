"use client";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  showValue?: boolean;
  className?: string;
  "aria-label"?: string;
};

const SIZE = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

/** Airbnb-style star row — clickable when onChange is provided. */
export function StarRating({
  value,
  onChange,
  size = "md",
  readOnly = !onChange,
  showValue = false,
  className = "",
  "aria-label": ariaLabel = "Rating",
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className={`flex items-center gap-0.5 ${SIZE[size]}`} role="img" aria-label={`${ariaLabel}: ${clamped} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(clamped);
          if (readOnly || !onChange) {
            return (
              <span key={star} className={filled ? "text-neutral-900" : "text-neutral-300"} aria-hidden>
                ★
              </span>
            );
          }
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`leading-none transition hover:scale-110 ${
                filled ? "text-neutral-900" : "text-neutral-300 hover:text-neutral-500"
              }`}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
            >
              ★
            </button>
          );
        })}
      </div>
      {showValue && clamped > 0 ? (
        <span className="ml-1 text-sm font-semibold text-neutral-800">{clamped.toFixed(1)}</span>
      ) : null}
    </div>
  );
}

/** Compact Airbnb-style “★ 4.92 · 128 reviews” trigger. */
export function RatingSummaryButton({
  average,
  count,
  onClick,
  emptyLabel = "New",
  className = "",
}: {
  average: number | null | undefined;
  count: number;
  onClick?: () => void;
  emptyLabel?: string;
  className?: string;
}) {
  const hasReviews = count > 0 && average != null;
  const label = hasReviews
    ? `★ ${Number(average).toFixed(2)} · ${count} review${count === 1 ? "" : "s"}`
    : emptyLabel;

  if (!onClick || !hasReviews) {
    return (
      <span
        className={`inline-flex items-center text-sm font-semibold text-neutral-800 ${
          !hasReviews ? "rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800" : ""
        } ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center text-sm font-semibold text-neutral-800 underline decoration-neutral-400 underline-offset-2 transition hover:decoration-neutral-900 ${className}`}
      aria-label={`Show ${count} reviews`}
    >
      {label}
    </button>
  );
}
