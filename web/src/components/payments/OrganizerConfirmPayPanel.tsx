"use client";

import { useCallback, useEffect, useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";

type OfferLine = {
  offerId: string;
  refMemberId: string;
  rateCents: number;
  gamesCount: number;
  refSubtotalCents: number;
};

type Breakdown = {
  offers: OfferLine[];
  refCount: number;
  refSubtotalCents: number;
  platformFeeCents: number;
  depositCents: number;
  depositAlreadyHeldCents: number;
  depositRequiredAfterCents: number;
  totalCents: number;
};

type DepositSummary = {
  requiredCents: number;
  collectedCents: number;
  appliedCents: number;
  refundedCents: number;
  refundableCents: number;
  status: string;
};

type PreviewResponse = {
  event: { id: string; title: string; endsAt: string | null; payOffer: number | null };
  breakdown: Breakdown | null;
  deposit: DepositSummary | null;
  error?: string;
};

function formatCents(cents: number) {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export type ConfirmPayEventOption = {
  eventId: string;
  title: string;
  unpaidCount: number;
};

export function OrganizerConfirmPayPanel({
  events,
  initialEventId,
  onPaid,
}: {
  events: ConfirmPayEventOption[];
  initialEventId?: string | null;
  onPaid?: () => void;
}) {
  const [eventId, setEventId] = useState(initialEventId || events[0]?.eventId || "");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && events[0]?.eventId) setEventId(events[0].eventId);
  }, [events, eventId]);

  useEffect(() => {
    if (initialEventId) setEventId(initialEventId);
  }, [initialEventId]);

  const load = useCallback(async (id: string) => {
    if (!id) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stripe/confirm-event-payment?eventId=${encodeURIComponent(id)}`);
      const data = (await res.json()) as PreviewResponse & { error?: string };
      if (!res.ok) {
        setPreview(null);
        setError(data.error || "Could not load payment preview.");
        return;
      }
      setPreview(data);
    } catch {
      setError("Could not load payment preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(eventId);
  }, [eventId, load]);

  async function confirmPay() {
    if (!eventId) return;
    setPaying(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/confirm-event-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = (await res.json()) as { error?: string; breakdown?: Breakdown };
      if (!res.ok) {
        setError(data.error || "Payment failed.");
        return;
      }
      setMsg(
        data.breakdown
          ? `Paid ${formatCents(data.breakdown.totalCents)}. Check your inbox for your receipt. Refs are paid by ACH after the event. Unused deposit is returned to your card after the event ends.`
          : "Payment confirmed. Check your inbox for your receipt."
      );
      await load(eventId);
      onPaid?.();
    } catch {
      setError("Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  async function refundDeposit() {
    if (!eventId) return;
    setRefunding(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/refund-event-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = (await res.json()) as {
        error?: string;
        refundedCents?: number;
        alreadyRefunded?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Could not refund deposit.");
        return;
      }
      setMsg(
        data.alreadyRefunded
          ? "Deposit already refunded."
          : `Refunded ${formatCents(data.refundedCents || 0)} deposit to your original payment method. Check your card or bank for the credit.`
      );
      await load(eventId);
      onPaid?.();
    } catch {
      setError("Could not refund deposit.");
    } finally {
      setRefunding(false);
    }
  }

  if (events.length === 0) {
    return null;
  }

  const breakdown = preview?.breakdown;
  const deposit = preview?.deposit;
  const eventEnded =
    preview?.event?.endsAt != null && new Date(preview.event.endsAt).getTime() <= Date.now();

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Confirm payment</p>
      <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Unpaid accepted refs</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Normally you’re charged when you approve a ref. Use this only if a charge was skipped. Total includes
        referee pay, the GotREFS fee, and a refundable deposit.
      </p>

      {events.length > 0 ? (
        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Event</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId}>
                {e.title}
                {e.unpaidCount > 0 ? ` · ${e.unpaidCount} unpaid` : " · paid"}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-neutral-500">Loading totals…</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}
      {msg ? <p className="mt-4 text-sm font-semibold text-emerald-700">{msg}</p> : null}

      {breakdown && breakdown.totalCents > 0 ? (
        <div className="mt-5 space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
          {breakdown.offers.map((line) => (
            <div key={line.offerId} className="flex justify-between gap-3 text-neutral-700">
              <span>
                Ref · {line.gamesCount} game{line.gamesCount === 1 ? "" : "s"} ×{" "}
                {formatCents(line.rateCents)}
              </span>
              <span className="font-semibold">{formatCents(line.refSubtotalCents)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-neutral-100 pt-2 text-neutral-700">
            <span>Referee pay</span>
            <span className="font-semibold">{formatCents(breakdown.refSubtotalCents)}</span>
          </div>
          <div className="flex justify-between gap-3 text-neutral-700">
            <span className="inline-flex items-center">
              GotREFS fee
              <InfoTip label="About the GotREFS fee">
                This is the GotREFS processing fee for running payments, holding funds, and paying refs after
                the event.
              </InfoTip>
            </span>
            <span className="font-semibold">{formatCents(breakdown.platformFeeCents)}</span>
          </div>
          <div className="flex justify-between gap-3 text-neutral-700">
            <span className="inline-flex max-w-[70%] items-center">
              <span>
                Refundable deposit (1 game × {breakdown.refCount} ref
                {breakdown.refCount === 1 ? "" : "s"}
                {breakdown.depositAlreadyHeldCents > 0 ? ", top-up" : ""})
              </span>
              <InfoTip label="About the refundable deposit">
                This deposit covers refs if they work extra games. If they don’t, it’s returned to you right
                after the event.
              </InfoTip>
            </span>
            <span className="font-semibold">{formatCents(breakdown.depositCents)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-neutral-200 pt-2 text-base font-bold text-neutral-900">
            <span>Total due now</span>
            <span>{formatCents(breakdown.totalCents)}</span>
          </div>
          <button
            type="button"
            disabled={paying}
            onClick={() => void confirmPay()}
            className="mt-3 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {paying ? "Charging…" : `Confirm and pay ${formatCents(breakdown.totalCents)}`}
          </button>
        </div>
      ) : !loading && eventId ? (
        <p className="mt-4 text-sm text-neutral-600">No unpaid accepted offers for this event.</p>
      ) : null}

      {deposit && deposit.refundableCents > 0 ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-700">
            Deposit held: <span className="font-semibold">{formatCents(deposit.refundableCents)}</span>
            {eventEnded ? " · Event ended — you can refund unused deposit." : " · Refundable after the event ends."}
          </p>
          {eventEnded ? (
            <button
              type="button"
              disabled={refunding}
              onClick={() => void refundDeposit()}
              className="mt-3 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            >
              {refunding ? "Refunding…" : `Refund ${formatCents(deposit.refundableCents)} deposit`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
