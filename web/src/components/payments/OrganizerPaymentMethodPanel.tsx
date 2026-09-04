"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { publicEnv } from "@/lib/env/public";

type PaymentMethodInfo = {
  brand: string | null;
  last4: string | null;
  type: string | null;
  updatedAt?: string | null;
};

type Stage = "intro" | "setup" | "ready";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    const key = publicEnv.stripePublishableKey();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

function SetupForm({ onSaved }: { onSaved: () => void }) {
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
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <p className="text-sm font-semibold text-[var(--red)]">{error}</p> : null}
      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card or bank"}
      </button>
    </form>
  );
}

export function OrganizerPaymentMethodPanel() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [starting, setStarting] = useState(false);
  const publishableKey = publicEnv.stripePublishableKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/organizer-payment-method");
      const json = (await res.json()) as {
        ready?: boolean;
        paymentMethod?: PaymentMethodInfo | null;
        error?: string;
      };
      if (!res.ok && json.error) {
        setError(json.error);
      }
      const isReady = Boolean(json.ready);
      setReady(isReady);
      setPaymentMethod(json.paymentMethod ?? null);
      setStage(isReady ? "ready" : "intro");
    } catch {
      setError("Could not load payment method status.");
      setStage("intro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Skip intro screens — open the card form as soon as Payments loads without a method.
  useEffect(() => {
    if (loading || ready || clientSecret || starting || stage === "setup") return;
    void continueWithStripe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when status settles not ready
  }, [loading, ready]);

  async function continueWithStripe() {
    setMsg(null);
    setError(null);
    if (!publishableKey) {
      setError("Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel to enable payment setup.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/stripe/organizer-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_setup_intent" }),
      });
      const json = (await res.json()) as { clientSecret?: string; error?: string };
      if (!res.ok || !json.clientSecret) {
        setError(json.error || "Could not start payment setup.");
        return;
      }
      setClientSecret(json.clientSecret);
      setStage("setup");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-neutral-500">Loading payments…</p>
      </section>
    );
  }

  if (stage === "ready" && paymentMethod) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-neutral-500">Required to pay officials</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Pay refs with Stripe</h2>
        {msg ? <p className="mt-3 text-sm font-semibold text-emerald-700">{msg}</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-bold text-emerald-900">
            Ready · {paymentMethod.brand || paymentMethod.type || "Payment method"}
            {paymentMethod.last4 ? ` ·•••• ${paymentMethod.last4}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void continueWithStripe()}
            className="rounded-full border border-emerald-800/30 px-4 py-1.5 text-xs font-bold text-emerald-900"
          >
            Update
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          When you approve a ref (or they accept your invite), GotRefs charges this method: referee pay, a
          20% fee on that pay only, and a refundable deposit (1 extra game per hired ref). Money is held
          until the game ends, then paid to the ref by ACH. Unused deposit is returned after the event.
        </p>
        {clientSecret ? (
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <Elements stripe={getStripePromise()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
              <SetupForm
                onSaved={() => {
                  setClientSecret(null);
                  setMsg("Payment method updated.");
                  void load();
                }}
              />
            </Elements>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-neutral-500 underline"
              onClick={() => setClientSecret(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  if (stage === "setup" && clientSecret) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-neutral-500">Required to pay officials</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Add card or bank</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Save a card once. GotRefs charges it when you approve a ref.
        </p>
        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5">
          <Elements stripe={getStripePromise()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <SetupForm
              onSaved={() => {
                setClientSecret(null);
                setMsg("Payment method saved. You’re ready to hire refs.");
                void load();
              }}
            />
          </Elements>
        </div>
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-neutral-500 underline"
          onClick={() => {
            setClientSecret(null);
            setStage("intro");
          }}
        >
          Back
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm text-neutral-500">Required to pay officials</p>
      <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Save a card to pay refs</h2>
      <p className="mt-2 text-sm text-neutral-500">
        One-time setup. You’ll be charged when you approve a referee.
      </p>
      {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
      {msg ? <p className="mt-4 text-sm font-semibold text-emerald-700">{msg}</p> : null}
      {starting ? <p className="mt-4 text-sm text-neutral-500">Opening secure card form…</p> : null}
      <button
        type="button"
        onClick={() => void continueWithStripe()}
        disabled={starting}
        className="mt-6 w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {starting ? "Opening…" : "Add card"}
      </button>
    </section>
  );
}
