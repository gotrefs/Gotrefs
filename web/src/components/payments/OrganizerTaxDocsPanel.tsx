"use client";

import { useCallback, useEffect, useState } from "react";

type LineItem = {
  payeeName: string;
  grossCents: number;
  status: string;
};

type PaymentRow = {
  id: string;
  status: string;
  purpose: string;
  eventTitle: string | null;
  amountSubtotalCents: number;
  platformFeeCents: number;
  amountTotalCents: number;
  paidAt: string | null;
  createdAt: string;
  lineItems: LineItem[];
};

type TaxSummary = {
  year: number;
  paymentCount: number;
  amountSubtotalCents: number;
  platformFeeCents: number;
  amountTotalCents: number;
  note?: string;
};

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "processing") return "Processing";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Refunded";
  if (status === "canceled") return "Canceled";
  return status;
}

export function OrganizerTaxDocsPanel({ highlightPaymentId }: { highlightPaymentId?: string | null }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        fetch("/api/organizer/payments"),
        fetch(`/api/organizer/tax-summary?year=${year}`),
      ]);
      const paymentsJson = (await paymentsRes.json()) as {
        payments?: PaymentRow[];
        error?: string;
      };
      const summaryJson = (await summaryRes.json()) as TaxSummary & { error?: string };

      if (!paymentsRes.ok) {
        setError(paymentsJson.error || "Could not load payments.");
        setPayments([]);
      } else {
        setPayments(paymentsJson.payments ?? []);
      }

      if (!summaryRes.ok) {
        setError((prev) => prev || summaryJson.error || "Could not load tax summary.");
        setSummary(null);
      } else {
        setSummary(summaryJson);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightPaymentId) return;
    const el = document.getElementById(`org-payment-${highlightPaymentId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightPaymentId, payments]);

  function openReceipt(paymentId: string) {
    window.open(`/api/organizer/payments/${paymentId}/receipt?format=html`, "_blank", "noopener,noreferrer");
  }

  function exportCsv() {
    window.location.href = `/api/organizer/tax-summary?year=${year}&format=csv`;
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Tax docs</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--navy)]">Payments &amp; receipts</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Download receipts and a year-end CSV of what you paid refs through GotREFS. This is expense
            documentation for your books — not a 1099. Officials get 1099-NEC via Stripe when required.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold text-neutral-700">
            Year{" "}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="ml-1 w-24 rounded-lg border border-neutral-300 px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-neutral-300 px-3 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!summary || summary.paymentCount === 0}
            className="rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Export tax summary (CSV)
          </button>
        </div>
      </div>

      {summary ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Officials paid</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{formatCents(summary.amountSubtotalCents)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">GotREFS fee</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{formatCents(summary.platformFeeCents)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Total charged · {year}</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{formatCents(summary.amountTotalCents)}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-neutral-500">Loading payments…</p> : null}

      <div className="mt-5 grid gap-3">
        {payments.length === 0 && !loading ? (
          <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
            No payments yet. After you pay accepted refs with Stripe, receipts will show up here.
          </p>
        ) : null}
        {payments.map((payment) => {
          const highlighted = highlightPaymentId === payment.id;
          const when = payment.paidAt || payment.createdAt;
          return (
            <article
              key={payment.id}
              id={`org-payment-${payment.id}`}
              className={`rounded-xl border px-4 py-4 ${
                highlighted ? "border-[var(--navy)] bg-sky-50" : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {payment.eventTitle || (payment.purpose === "vendor" ? "Vendor payment" : "Payment")}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {statusLabel(payment.status)} · {new Date(when).toLocaleString()} ·{" "}
                    {formatCents(payment.amountTotalCents)} charged
                  </p>
                  {payment.lineItems.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                      {payment.lineItems.map((item, idx) => (
                        <li key={`${payment.id}-${idx}`}>
                          {item.payeeName} · {formatCents(item.grossCents)} · {statusLabel(item.status)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-500">
                    Includes {formatCents(payment.platformFeeCents)} GotREFS fee
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openReceipt(payment.id)}
                  className="rounded-full border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                >
                  Download receipt
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
