"use client";

import { useCallback, useEffect, useState } from "react";
import { StripePromptModal } from "@/components/payments/StripePromptModal";

/** Fired by booking actions when the organizer has no card on file yet. */
export const CARD_REQUIRED_EVENT = "gotrefs:card-required";

/** Ask the card prompt to open (call when a booking action reports a missing card). */
export function requestOrganizerCard() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CARD_REQUIRED_EVENT));
}

/**
 * Stripe Checkout prompt for organizers without a card on file.
 * It does NOT open on its own at signup/login — only when a booking needs a card
 * (see requestOrganizerCard) — and it can be dismissed.
 */
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

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const openPrompt = () => {
      setError(null);
      setOpen(true);
    };
    window.addEventListener(CARD_REQUIRED_EVENT, openPrompt);
    return () => window.removeEventListener(CARD_REQUIRED_EVENT, openPrompt);
  }, []);

  if (loading || !open) return null;

  return (
    <StripePromptModal
      eyebrow="Secure payments"
      title="Add a card to pay your REF"
      actionLabel="Continue to Stripe"
      busy={starting}
      error={error}
      onAction={() => void startStripe()}
      onDismiss={() => setOpen(false)}
    >
      Fill this out on Stripe so your REF can be paid. You&apos;re only charged when a REF accepts.
      Stripe protects your card details. GotREFS never stores your full card number.
    </StripePromptModal>
  );
}
