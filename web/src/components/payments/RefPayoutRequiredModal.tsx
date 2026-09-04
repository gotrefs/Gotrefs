"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MfaSettingsPanel } from "@/components/security/MfaSettingsPanel";

type ConnectStatus = {
  onboarding_complete?: boolean;
  payouts_enabled?: boolean;
} | null;

/** On login: get refs into Stripe payout setup with as few clicks as possible. */
export function RefPayoutRequiredModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaAal2, setMfaAal2] = useState(false);
  const autoStarted = useRef(false);

  const startStripe = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", {
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
        const res = await fetch("/api/stripe/connect");
        const json = (await res.json()) as {
          connect?: ConnectStatus;
          mfaRequired?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not check payout status.");
          setLoading(false);
          return;
        }
        const needsMfa = json.mfaRequired !== false;
        setMfaRequired(needsMfa);
        const ready = Boolean(json.connect?.onboarding_complete || json.connect?.payouts_enabled);
        if (ready) {
          setLoading(false);
          return;
        }
        setOpen(true);
        setLoading(false);
        // No MFA required (e.g. local test): go straight to Stripe.
        if (!needsMfa && !autoStarted.current) {
          autoStarted.current = true;
          void startStripe();
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startStripe]);

  // After 2FA is satisfied, jump into Stripe without another click.
  useEffect(() => {
    if (!open || !mfaRequired) return;
    if (!(mfaEnrolled && mfaAal2)) return;
    if (autoStarted.current || starting) return;
    autoStarted.current = true;
    void startStripe();
  }, [open, mfaRequired, mfaEnrolled, mfaAal2, starting, startStripe]);

  if (loading || !open) return null;

  const waitingOnMfa = mfaRequired && !(mfaEnrolled && mfaAal2);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-neutral-900">Save a card on file to get paid</h2>
        <p className="mt-2 text-sm text-neutral-600">
          {waitingOnMfa
            ? "Turn on 2FA below — we’ll open Stripe right after so you can add your payout method."
            : starting
              ? "Opening Stripe…"
              : "Continue to Stripe to add your payout method."}
        </p>

        {waitingOnMfa ? (
          <div className="mt-4">
            <MfaSettingsPanel
              compact
              title="Quick 2FA setup"
              onStatusChange={(s) => {
                setMfaEnrolled(s.enrolled);
                setMfaAal2(s.currentLevel === "aal2");
              }}
            />
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm font-semibold text-red-600">
            {error}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                autoStarted.current = false;
                void startStripe();
              }}
            >
              Retry
            </button>
          </p>
        ) : null}

        {!waitingOnMfa && !starting ? (
          <button
            type="button"
            onClick={() => {
              autoStarted.current = false;
              void startStripe();
            }}
            className="mt-5 w-full rounded-xl bg-[#d81d24] px-5 py-3 text-sm font-bold text-white"
          >
            Continue with Stripe
          </button>
        ) : null}

        {starting ? <p className="mt-4 text-sm font-semibold text-neutral-700">Opening Stripe…</p> : null}
      </div>
    </div>
  );
}
