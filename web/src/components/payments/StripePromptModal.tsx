"use client";

import type { ReactNode } from "react";

function StripeMark() {
  return (
    <span className="select-none text-[22px] font-bold tracking-tight text-[#635BFF]" aria-label="Stripe">
      stripe
    </span>
  );
}

/**
 * The Stripe pop-up shared by every "go to Stripe" moment: an organizer adding a card
 * when they book, and a Ref connecting payouts once they have a game.
 * Presentation only; the caller decides when it opens and what the button does.
 */
export function StripePromptModal({
  eyebrow,
  title,
  children,
  actionLabel,
  busy,
  error,
  onAction,
  onDismiss,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actionLabel: string;
  busy: boolean;
  error: string | null;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-prompt-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-neutral-100 bg-gradient-to-b from-[#f6f5ff] to-white px-6 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635BFF]">{eyebrow}</p>
            <StripeMark />
          </div>
          <h2 id="stripe-prompt-title" className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{children}</p>
        </div>

        <div className="px-6 py-5">
          {error ? (
            <p className="mb-3 text-sm font-semibold text-red-600">
              {error}{" "}
              <button type="button" className="underline" onClick={onAction}>
                Retry
              </button>
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={onAction}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#5851ea] disabled:opacity-60"
          >
            {busy ? "Opening Stripe…" : actionLabel}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-500">
            You’ll finish on Stripe’s secure site, then return to GotREFS.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
