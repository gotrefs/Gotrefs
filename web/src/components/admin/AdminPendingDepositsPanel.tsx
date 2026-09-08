"use client";

import { useCallback, useEffect, useState } from "react";

type DepositRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  sport: string | null;
  startsAt: string | null;
  endsAt: string | null;
  eventEnded: boolean;
  organizerMemberId: string;
  organizerName: string;
  organizerEmail: string | null;
  status: string;
  collectedCents: number;
  appliedCents: number;
  refundedCents: number;
  refundableCents: number;
  refundReady: boolean;
  updatedAt: string;
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function AdminPendingDepositsPanel() {
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/deposits/pending");
      const json = (await res.json()) as {
        deposits?: DepositRow[];
        note?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load deposit queue.");
        setRows([]);
        return;
      }
      setRows(json.deposits ?? []);
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

  const readyCount = rows.filter((r) => r.refundReady).length;

  return (
    <section className="mt-10 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Deposits</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--navy)]">Pending deposit refunds</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            {note ||
              "Organizers owed unused deposit back. Auto-refunds run daily after the event ends; this list is your ops view."}
          </p>
          {!loading && rows.length > 0 ? (
            <p className="mt-2 text-sm font-semibold text-neutral-800">
              {readyCount} ready to refund · {rows.length} with balance held
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

      {!loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No held deposit balances right now.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Organizer</th>
                <th className="px-2 py-2">Refundable</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Event ends</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-neutral-900">{r.eventTitle}</p>
                    <p className="text-xs text-neutral-500">
                      {r.sport || "Sport"} · {r.eventId.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    <p className="font-semibold text-neutral-900">{r.organizerName}</p>
                    <p className="text-xs text-neutral-500">{r.organizerEmail || r.organizerMemberId}</p>
                  </td>
                  <td className="px-2 py-2 font-semibold">{formatCents(r.refundableCents)}</td>
                  <td className="px-2 py-2">
                    {r.refundReady ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Refund ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
                        Held until event end
                      </span>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      ledger {r.status} · applied {formatCents(r.appliedCents)} · already refunded{" "}
                      {formatCents(r.refundedCents)}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-neutral-700">{formatWhen(r.endsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
