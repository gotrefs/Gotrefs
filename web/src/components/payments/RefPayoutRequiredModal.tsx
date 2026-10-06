"use client";

import { useCallback, useEffect, useState } from "react";
import { StripePromptModal } from "@/components/payments/StripePromptModal";

type ConnectStatus = {
  onboarding_complete?: boolean;
  payouts_enabled?: boolean;
} | null;

/**
 * Stripe Connect prompt for Refs without payout setup.
 * It stays closed until the Ref has a job (`hasAcceptedJob`): new signups are not
 * asked for bank details before there is anything to be paid for. It can be dismissed.
 */
export function RefPayoutRequiredModal({ hasAcceptedJob }: { hasAcceptedJob: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // Nothing to be paid for yet: don't check Stripe, don't prompt.
    if (!hasAcceptedJob) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/connect");
        const json = (await res.json()) as {
          connect?: ConnectStatus;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not check payout status.");
          setLoading(false);
          return;
        }
        const ready = Boolean(json.connect?.onboarding_complete || json.connect?.payouts_enabled);
        if (!ready) setOpen(true);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAcceptedJob]);

  if (!hasAcceptedJob || loading || !open) return null;

  return (
    <StripePromptModal
      eyebrow="Secure payouts"
      title="You've got a game. Connect via Stripe to get paid"
      actionLabel="Connect with Stripe"
      busy={starting}
      error={error}
      onAction={() => void startStripe()}
      onDismiss={() => setOpen(false)}
    >
      Add where your pay should go. Stripe protects your bank details. GotREFS never stores your
      full card or account numbers.
    </StripePromptModal>
  );
}
