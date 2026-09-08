"use client";

import { useCallback, useEffect, useState } from "react";

type PaymentMethodInfo = {
  brand: string | null;
  last4: string | null;
  type: string | null;
  updatedAt?: string | null;
};

function StripeMark() {
  return (
    <span className="select-none text-[20px] font-bold tracking-tight text-[#635BFF]" aria-label="Stripe">
      stripe
    </span>
  );
}

export function OrganizerPaymentMethodPanel() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");
      if (sessionId && params.get("pm") === "return") {
        const confirmRes = await fetch("/api/stripe/organizer-payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_checkout_session", sessionId }),
        });
        if (confirmRes.ok) {
          setMsg("Payment method saved. You’re ready to hire refs.");
        }
        window.history.replaceState({}, "", "/dashboard/organizer?tab=payments");
      }

      const res = await fetch("/api/stripe/organizer-payment-method");
      const json = (await res.json()) as {
        ready?: boolean;
        paymentMethod?: PaymentMethodInfo | null;
        error?: string;
      };
      if (!res.ok && json.error) {
        setError(json.error);
      }
      setReady(Boolean(json.ready));
      setPaymentMethod(json.paymentMethod ?? null);
    } catch {
      setError("Could not load payment method status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function continueWithStripe() {
    setMsg(null);
    setError(null);
    setStarting(true);
    try {
      const res = await fetch("/api/stripe/organizer-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "onboard" }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error || "Could not open Stripe.");
        setStarting(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setError("Could not reach Stripe. Try again.");
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

  if (ready && paymentMethod) {
    return (
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-gradient-to-b from-[#f6f5ff] to-white px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635BFF]">
              Secure payments
            </p>
            <StripeMark />
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-neutral-900">Pay refs with Stripe</h2>
        </div>
        <div className="px-6 py-5">
          {msg ? <p className="mb-3 text-sm font-semibold text-emerald-700">{msg}</p> : null}
          {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-bold text-emerald-900">
              Ready · {paymentMethod.brand || paymentMethod.type || "Payment method"}
              {paymentMethod.last4 ? ` ·•••• ${paymentMethod.last4}` : ""}
            </p>
            <button
              type="button"
              onClick={() => void continueWithStripe()}
              disabled={starting}
              className="rounded-full border border-emerald-800/30 px-4 py-1.5 text-xs font-bold text-emerald-900 disabled:opacity-60"
            >
              {starting ? "Opening…" : "Update"}
            </button>
          </div>
          <p className="mt-3 text-sm text-neutral-500">
            When you approve a ref (or they accept your invite), GotREFS charges this method: referee pay, the
            GotREFS fee, and a refundable deposit (1 extra game per hired ref). Money is held until the game
            ends, then paid to the ref by ACH. Unused deposit is returned after the event.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 bg-gradient-to-b from-[#f6f5ff] to-white px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#635BFF]">
            Secure payments
          </p>
          <StripeMark />
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900">
          Save a card on file to pay out refs
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Stripe protects your card details. Finish setup on Stripe’s site, then you’re ready to hire.
        </p>
      </div>
      <div className="px-6 py-5">
        {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
        {msg ? <p className="mb-3 text-sm font-semibold text-emerald-700">{msg}</p> : null}
        <button
          type="button"
          onClick={() => void continueWithStripe()}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#635BFF] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#5851ea] disabled:opacity-60"
        >
          {starting ? "Opening Stripe…" : "Connect with Stripe"}
        </button>
        <p className="mt-3 text-center text-xs text-neutral-500">
          You’ll finish setup on Stripe’s secure site, then return to GotREFS.
        </p>
      </div>
    </section>
  );
}
