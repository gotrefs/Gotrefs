"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { publicEnv } from "@/lib/env/public";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    const key = publicEnv.stripePublishableKey();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

function InlineSetupForm({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/organizer?tab=payments&pm=return`,
        },
      });
      if (result.error) {
        setError(result.error.message || "Could not save payment method.");
        return;
      }
      const paymentMethodId =
        typeof result.setupIntent?.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent?.payment_method?.id;
      if (paymentMethodId) {
        await fetch("/api/stripe/organizer-payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_saved", paymentMethodId }),
        });
      }
      onSaved();
    } catch {
      setError("Could not reach Stripe. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 text-left">
      <PaymentElement
        options={{
          layout: "tabs",
          paymentMethodOrder: ["card", "us_bank_account"],
        }}
      />
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

/** On login: open card form immediately if organizer has no payment method. */
export function OrganizerCardRequiredModal() {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const publishableKey = publicEnv.stripePublishableKey();

  const startSetup = useCallback(async () => {
    if (!publishableKey) {
      setError("Stripe is not configured yet. Contact support.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/organizer-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_setup_intent" }),
      });
      const json = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !json.clientSecret) {
        setError(json.error || "Could not start card setup.");
        return;
      }
      setClientSecret(json.clientSecret);
    } catch {
      setError("Could not reach Stripe. Try again.");
    } finally {
      setStarting(false);
    }
  }, [publishableKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/organizer-payment-method");
        const json = (await res.json()) as { ready?: boolean };
        if (cancelled || json.ready) return;
        setOpen(true);
        await startSetup();
      } catch {
        // Non-blocking.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startSetup]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-neutral-900">Save a card on file to pay out refs</h2>
        <p className="mt-2 text-sm text-neutral-600">Enter your card below — one step, then you’re ready to hire.</p>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-red-600">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void startSetup()}>
              Retry
            </button>
          </p>
        ) : null}

        {starting && !clientSecret ? (
          <p className="mt-5 text-sm text-neutral-500">Loading secure form…</p>
        ) : null}

        {clientSecret ? (
          <div className="mt-5">
            <Elements stripe={getStripePromise()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
              <InlineSetupForm onSaved={() => setOpen(false)} />
            </Elements>
          </div>
        ) : null}
      </div>
    </div>
  );
}
