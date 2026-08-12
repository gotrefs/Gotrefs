"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MfaSettingsPanel } from "@/components/security/MfaSettingsPanel";

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
      return "Waiting for W-9 / tax ID";
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
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaAal2, setMfaAal2] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(true);

  const load = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/stripe/connect");
      const json = (await res.json()) as {
        connect?: ConnectStatus;
        payouts?: PayoutRow[];
        mfaRequired?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load payout status.");
        return;
      }
      setConnect(json.connect ?? null);
      setPayouts(json.payouts ?? []);
      setMfaRequired(json.mfaRequired !== false);
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
      let json: { error?: string; code?: string; url?: string; note?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        setError(
          res.ok
            ? "Stripe returned an unexpected response. Try again in a moment."
            : `Could not open Stripe (${res.status}). Is the app running?`
        );
        return;
      }
      if (!res.ok) {
        if (json.code === "mfa_enroll_required" || json.code === "mfa_required") {
          setError(json.error || "Complete two-factor authentication first.");
        } else {
          setError(json.error || "Could not open Stripe onboarding.");
        }
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
      setError(`Could not reach Stripe Connect (${detail}). Confirm npm run dev is running, then try again.`);
    } finally {
      setLoading(false);
    }
  }

  const canOpenStripe = !mfaRequired || (mfaEnrolled && mfaAal2);

  return (
    <div className="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--red)]">Get paid</p>
        <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">
          ACH direct deposit & 1099
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Connect your bank with Stripe Express. After an organizer pays for your game, GotRefs
          transfers your pay and Stripe deposits it by ACH. Your GotRefs earnings show in{" "}
          <strong>Recent payouts</strong> below. Stripe&apos;s Express dashboard is only for managing
          your bank account and tax details on Stripe.
        </p>
      </div>

      {mfaRequired ? (
        <MfaSettingsPanel
          onStatusChange={(s) => {
            setMfaEnrolled(s.enrolled);
            setMfaAal2(s.currentLevel === "aal2");
          }}
        />
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Local Stripe test mode: 2FA is not required to open Connect onboarding.
        </p>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-bold text-neutral-900">Bank & tax status</p>
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
            <li>
              W-9 / tax ID on file:{" "}
              {connect?.tax_id_provided ? (
                <span className="font-semibold text-emerald-700">Yes</span>
              ) : (
                "No — required before payouts"
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
              You&apos;re all set — you can start getting paid instantly.
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              {connect.tax_id_provided
                ? "When an organizer pays for your game, GotRefs transfers your pay and Stripe deposits it by ACH."
                : "Finish adding your W-9 / tax ID above if Stripe still asks for it, then payouts can deposit by ACH as soon as organizers pay."}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !canOpenStripe}
            onClick={() => void startOnboarding("onboard")}
            className="rounded-full bg-[#d81d24] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Opening Stripe…"
              : connect?.onboarding_complete
                ? "Update bank / tax info"
                : "Set up ACH direct deposit"}
          </button>
          {connect?.onboarding_complete ? (
            <button
              type="button"
              disabled={loading || !canOpenStripe}
              onClick={() => void startOnboarding("login")}
              className="rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
            >
              Manage bank &amp; tax in Stripe
            </button>
          ) : null}
        </div>
        {connect?.onboarding_complete ? (
          <p className="mt-2 text-xs text-neutral-500">
            That button opens Stripe&apos;s Express site (bank + tax settings). To see what you&apos;ve earned on
            GotRefs, use <span className="font-semibold">Recent payouts</span> below.
          </p>
        ) : null}
        {mfaRequired && (!mfaEnrolled || !mfaAal2) ? (
          <p className="mt-2 text-xs text-neutral-500">
            Enable and verify 2FA above before connecting your bank.
          </p>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <div>
        <p className="text-sm font-bold text-neutral-900">Recent payouts</p>
        <p className="mt-1 text-xs text-neutral-500">
          Your GotRefs earnings from games and transfers — this is the pay history for your taxes and 1099.
        </p>
        {payouts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No payouts yet. After organizers pay for your games, amounts will show here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-neutral-900">{formatMoney(p.gross_cents)}</p>
                  <p className="text-xs text-neutral-500">
                    {statusLabel(p.status)} · tax year {p.tax_year}
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
