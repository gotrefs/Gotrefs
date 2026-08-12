"use client";

import { useCallback, useEffect, useState } from "react";

type TaxRow = {
  memberId: string;
  displayName: string;
  email: string | null;
  grossCents: number;
  grossDollars: number;
  payoutCount: number;
  vendorPayoutCents: number;
  taxIdProvided: boolean;
  onboardingComplete: boolean;
  stripeAccountId: string | null;
  meetsNecThreshold: boolean;
};

export function AdminTax1099Panel() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tax/1099?year=${year}`);
      const json = (await res.json()) as {
        totals?: TaxRow[];
        filingNote?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not load 1099 ledger.");
        setRows([]);
        return;
      }
      setRows(json.totals ?? []);
      setNote(json.filingNote ?? null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  function downloadCsv() {
    const header = [
      "member_id",
      "display_name",
      "email",
      "gross_dollars",
      "payout_count",
      "tax_id_provided",
      "meets_nec_threshold",
      "stripe_account_id",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.memberId,
          JSON.stringify(r.displayName),
          JSON.stringify(r.email ?? ""),
          r.grossDollars.toFixed(2),
          r.payoutCount,
          r.taxIdProvided,
          r.meetsNecThreshold,
          r.stripeAccountId ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gotrefs-1099-ledger-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-10 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">Tax</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--navy)]">1099 distribution ledger</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            {note ||
              "YTD paid transfers for Stripe Connect 1099-NEC. Stripe files and distributes forms; export this for audit."}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="rounded-full bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-neutral-500">Loading…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No paid payouts for {year} yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">Payee</th>
                <th className="px-2 py-2">Gross</th>
                <th className="px-2 py-2">Payouts</th>
                <th className="px-2 py-2">Tax ID</th>
                <th className="px-2 py-2">NEC ≥ $600</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.memberId} className="border-b border-neutral-100">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-neutral-900">{r.displayName}</p>
                    <p className="text-xs text-neutral-500">{r.email || r.memberId}</p>
                  </td>
                  <td className="px-2 py-2 font-semibold">
                    {r.grossDollars.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </td>
                  <td className="px-2 py-2">{r.payoutCount}</td>
                  <td className="px-2 py-2">{r.taxIdProvided ? "Yes" : "Missing"}</td>
                  <td className="px-2 py-2">{r.meetsNecThreshold ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
