"use client";

import { useCallback, useEffect, useState } from "react";

type PaymentOpsRow = {
  id: string;
  status: string;
  eventId: string | null;
  eventTitle: string;
  sport: string | null;
  endsAt: string | null;
  eventEnded: boolean;
  organizerName: string;
  organizerEmail: string | null;
  amountTotalCents: number;
  amountSubtotalCents: number;
  platformFeeCents: number;
  paidAt: string | null;
  stripePaymentIntentId: string | null;
  offerCount: number;
  disbursed: boolean;
  payoutDisbursedAt: string | null;
  transferredCount: number;
  heldPayoutCount: number;
  payoutCount: number;
  canDisburse: boolean;
  canRefund: boolean;
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function AdminPaymentsOpsPanel() {
  const [rows, setRows] = useState<PaymentOpsRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payments/ops");
      const json = (await res.json()) as {
        payments?: PaymentOpsRow[];
        note?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load payments.");
        setRows([]);
        return;
      }
      setRows(json.payments ?? []);
      setNote(json.note ?? null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    row: PaymentOpsRow,
    action: "disburse" | "refund",
    allowTransferred = false
  ) {
    if (action === "disburse") {
      const ok = window.confirm(
        `Disburse ${formatCents(row.amountSubtotalCents)} to refs for “${row.eventTitle}” now?\n\nThis creates Stripe Connect transfers immediately.`
      );
      if (!ok) return;
    } else {
      const transferWarn =
        row.transferredCount > 0
          ? `\n\nWARNING: ${row.transferredCount} transfer(s) already sent to refs. You must reverse those in Stripe separately.`
          : "";
      const ok = window.confirm(
        `Refund full organizer charge ${formatCents(row.amountTotalCents)} for “${row.eventTitle}”?${transferWarn}\n\nThis resets offer payment status so the organizer can be charged again.`
      );
      if (!ok) return;
    }

    setBusyId(row.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: row.id,
          action,
          allowTransferred: action === "refund" ? allowTransferred || row.transferredCount > 0 : undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        refundedCents?: number;
        alreadyRefunded?: boolean;
        result?: { results?: Array<{ status: string }> };
      };
      if (!res.ok) {
        if (json.code === "has_transfers") {
          const force = window.confirm(
            `${json.error}\n\nRefund the organizer charge anyway? (You still need to reverse Connect transfers in Stripe.)`
          );
          if (force) {
            await runAction(row, "refund", true);
          }
          return;
        }
        setError(json.error || `${action} failed.`);
        return;
      }
      if (action === "disburse") {
        const results = json.result?.results ?? [];
        const paid = results.filter((r) => r.status === "paid").length;
        const held = results.length - paid;
        setMsg(
          `Disburse finished: ${paid} transferred${held > 0 ? `, ${held} held (Connect incomplete)` : ""}.`
        );
      } else {
        setMsg(
          json.alreadyRefunded
            ? "Payment already refunded in Stripe."
            : `Refunded ${formatCents(json.refundedCents || 0)} to organizer.`
        );
      }
      await load();
    } catch {
      setError(`${action} failed.`);
    } finally {
      setBusyId(null);
    }
  }

  const waitingDisburse = rows.filter((r) => r.canDisburse).length;

  return (
    <section className="mt-10 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Payments</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--navy)]">Pay refs & refund charges</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            {note ||
              "Disburse sends money to refs via Connect. Full refund returns the organizer Stripe charge when something goes wrong."}
          </p>
          {!loading ? (
            <p className="mt-2 text-sm font-semibold text-neutral-800">
              {waitingDisburse} waiting to disburse · {rows.length} recent payments
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-neutral-300 px-3 py-2 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-neutral-500">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {msg ? <p className="mt-4 text-sm font-semibold text-emerald-700">{msg}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No event payments yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">Event / organizer</th>
                <th className="px-2 py-2">Charged</th>
                <th className="px-2 py-2">Payouts</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 align-top">
                  <td className="px-2 py-3">
                    <p className="font-semibold text-neutral-900">{r.eventTitle}</p>
                    <p className="text-xs text-neutral-500">
                      {r.sport || "Sport"} · {r.offerCount} offer{r.offerCount === 1 ? "" : "s"}
                      {r.eventEnded ? " · event ended" : ""}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600">
                      {r.organizerName}
                      {r.organizerEmail ? ` · ${r.organizerEmail}` : ""}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {r.id.slice(0, 8)}… · paid {formatWhen(r.paidAt)}
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <p className="font-semibold">{formatCents(r.amountTotalCents)}</p>
                    <p className="text-xs text-neutral-500">
                      refs {formatCents(r.amountSubtotalCents)} · fee {formatCents(r.platformFeeCents)}
                    </p>
                  </td>
                  <td className="px-2 py-3 text-xs text-neutral-600">
                    <p>{r.transferredCount} transferred</p>
                    <p>{r.heldPayoutCount} held / pending</p>
                    <p>{r.payoutCount} payout row{r.payoutCount === 1 ? "" : "s"}</p>
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.status === "paid"
                          ? "bg-emerald-50 text-emerald-800"
                          : r.status === "refunded"
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {r.status}
                    </span>
                    <p className="mt-1 text-xs text-neutral-500">
                      {r.disbursed
                        ? `Disbursed ${formatWhen(r.payoutDisbursedAt)}`
                        : r.status === "paid"
                          ? "Not disbursed yet"
                          : "—"}
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-2">
                      {r.canDisburse ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void runAction(r, "disburse")}
                          className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {busyId === r.id ? "Working…" : "Disburse now"}
                        </button>
                      ) : null}
                      {r.canRefund ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void runAction(r, "refund")}
                          className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busyId === r.id ? "Working…" : "Refund full charge"}
                        </button>
                      ) : null}
                      {!r.canDisburse && !r.canRefund ? (
                        <span className="text-xs text-neutral-400">No actions</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
