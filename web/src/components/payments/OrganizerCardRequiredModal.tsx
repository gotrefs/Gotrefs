"use client";

import { useCallback, useEffect, useState } from "react";

function StripeMark() {
  return (
    <span className="select-none text-[22px] font-bold tracking-tight text-[#635BFF]" aria-label="Stripe">
      stripe
    </span>
  );
}

/** On login: Stripe Checkout prompt for organizers without a card on file. */
export function OrganizerCardRequiredModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStripe = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/organizer-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboard" }),
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) {
        setError(json.error || "Could not open Stripe.");
        setStarting(false);
        return;
      }
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      setError("Could not open Stripe. Try again.");
      setStarting(false);
    } catch {
      setError("Could not reach Stripe. Try again.");
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        if (sessionId && params.get("pm") === "return") {
          await fetch("/api/stripe/organizer-payment-method", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm_checkout_session", sessionId }),
          });
          window.history.replaceState({}, "", "/dashboard/organizer?tab=payments");
        }

        const res = await fetch("/api/stripe/organizer-payment-method");
        const json = (await res.json()) as { ready?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not check payment status.");
          setLoading(false);
          return;
        }
        if (!json.ready) setOpen(true);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-neutral-100 bg-gradient-to-b from-[#f6f5ff] to-white px-6 pb-5 pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635BFF]">
              Secure payments
            </p>
            <StripeMark />
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
            Save a card on file to pay out refs: Connect via Stripe
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Stripe protects your card details. GotREFS never stores your full card number.
          </p>
        </div>

        <div className="px-6 py-5">
          {error ? (
            <p className="mb-3 text-sm font-semibold text-red-600">
              {error}{" "}
              <button type="button" className="underline" onClick={() => void startStripe()}>
                Retry
              </button>
            </p>
          ) : null}

          <button
            type="button"
            disabled={starting}
            onClick={() => void startStripe()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#5851ea] disabled:opacity-60"
          >
            {starting ? "Opening Stripe…" : "Connect with Stripe"}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-500">
            You’ll finish setup on Stripe’s secure site, then return to GotREFS.
          </p>
        </div>
      </div>
    </div>
  );
}
