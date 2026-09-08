"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ConnectStatus = {
  stripe_account_id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  tax_id_provided?: boolean;
  onboarding_complete?: boolean;
  requirements_due?: string[];
} | null;

type PayoutRow = {
  id: string;
  gross_cents: number;
  status: string;
  tax_year: number;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid (ACH)";
    case "pending_onboarding":
      return "Waiting for bank setup";
    case "pending_tax":
      return "Waiting for tax details in Stripe";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return status.replace(/_/g, " ");
  }
}

export function RefPayoutPanel() {
  const searchParams = useSearchParams();
  const [connect, setConnect] = useState<ConnectStatus>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const load = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/stripe/connect");
      const json = (await res.json()) as {
        connect?: ConnectStatus;
        payouts?: PayoutRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load payout status.");
        return;
      }
      setConnect(json.connect ?? null);
      setPayouts(json.payouts ?? []);
      setError(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connectParam = searchParams.get("connect");
    if (connectParam === "return" || connectParam === "refresh") {
      void load();
    }
  }, [searchParams, load]);

  async function startOnboarding(action: "onboard" | "login" = "onboard") {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const raw = await res.text();
      let json: { error?: string; url?: string; note?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        setError(
          res.ok
            ? "Stripe returned an unexpected response. Try again in a moment."
            : `Could not open Stripe (${res.status}).`
        );
        return;
      }
      if (!res.ok) {
        setError(json.error || "Could not open Stripe onboarding.");
        return;
      }
      if (json.note) setMsg(json.note);
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      setMsg("Stripe Connect is ready.");
      await load();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      setError(`Could not reach Stripe Connect (${detail}).`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--red)]">Payments</p>
        <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">Get paid with Stripe</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Connect your payout method with Stripe. When organizers pay for your games, GotRefs deposits your
          pay by ACH.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-bold text-neutral-900">Stripe payout status</p>
        {statusLoading ? (
          <p className="mt-2 text-sm text-neutral-500">Refreshing Stripe status…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li>
              Bank onboarding:{" "}
              {connect?.onboarding_complete ? (
                <span className="font-semibold text-emerald-700">Complete</span>
              ) : connect ? (
                <span className="font-semibold text-amber-700">In progress</span>
              ) : (
                <span className="font-semibold text-neutral-600">Not started</span>
              )}
            </li>
            <li>
              ACH payouts enabled:{" "}
              {connect?.payouts_enabled ? (
                <span className="font-semibold text-emerald-700">Yes</span>
              ) : (
                "No"
              )}
            </li>
          </ul>
        )}
        {connect?.requirements_due && connect.requirements_due.length > 0 ? (
          <p className="mt-2 text-xs text-amber-700">
            Stripe still needs: {connect.requirements_due.slice(0, 4).join(", ")}
            {connect.requirements_due.length > 4 ? "…" : ""}
          </p>
        ) : null}

        {connect?.onboarding_complete && !statusLoading ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
            <p className="text-sm font-semibold text-emerald-800">
              You&apos;re all set — you can start getting paid.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void startOnboarding("onboard")}
            className="rounded-full bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Opening Stripe…"
              : connect?.onboarding_complete
                ? "Update in Stripe"
                : "Connect with Stripe"}
          </button>
          {connect?.onboarding_complete ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void startOnboarding("login")}
              className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
            >
              Manage in Stripe
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <div>
        <p className="text-sm font-bold text-neutral-900">Recent payouts</p>
        <p className="mt-1 text-xs text-neutral-500">Earnings transferred to your bank after organizers pay.</p>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No payouts yet. After organizers pay for your games, amounts will show here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-neutral-900">{formatMoney(p.gross_cents)}</p>
                  <p className="text-xs text-neutral-500">
                    {statusLabel(p.status)}
                    {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {new Date(p.paid_at || p.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
