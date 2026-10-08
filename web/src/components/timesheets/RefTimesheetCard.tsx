"use client";

import { useState } from "react";
import { type Timesheet, unitLabel } from "@/lib/timesheets";

function timeOf(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
}

/** The REF's view of their timesheet for one booking, with Approve / Dispute when it's their turn. */
export function RefTimesheetCard({
  sheet,
  onChanged,
}: {
  sheet: Timesheet;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "dispute") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/timesheets/${sheet.booking_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: action === "dispute" ? note : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save. Try again.");
      setDisputing(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const worked = sheet.worked_units;
  const differs = worked != null && Number(worked) !== Number(sheet.booked_units);

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800">
      <p className="font-semibold text-neutral-900">Timesheet</p>
      <p className="mt-1 text-neutral-600">
        Checked in {timeOf(sheet.checked_in_at)}
        {sheet.checked_out_at ? ` · Clocked out ${timeOf(sheet.checked_out_at)}` : " · On the clock"}
      </p>
      {worked != null ? (
        <p className="mt-1">
          Organizer reported <span className="font-semibold">{unitLabel(sheet.pay_unit, Number(worked))}</span>
          {differs ? (
            <span className="text-amber-700"> (booked for {unitLabel(sheet.pay_unit, Number(sheet.booked_units))})</span>
          ) : null}
        </p>
      ) : null}

      {sheet.status === "approved" ? (
        <p className="mt-2 font-medium text-emerald-700">
          ✓ Approved{sheet.auto_approved ? " automatically after 48 hours" : ""}
          {sheet.settled_at && sheet.ref_pay_cents != null
            ? ` · Your pay: $${(sheet.ref_pay_cents / 100).toFixed(2)}`
            : ""}
        </p>
      ) : null}
      {sheet.status === "disputed" ? (
        <p className="mt-2 text-red-700">
          You disputed this total{sheet.dispute_note ? `: “${sheet.dispute_note}”` : ""} — GotREFS will follow up.
        </p>
      ) : null}

      {sheet.status === "awaiting_ref" ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3">
          <p className="font-medium text-amber-900">Please sign off on this total.</p>
          {disputing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="What should the total be, and why?"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={() => decide("dispute")}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send dispute
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDisputing(false)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("approve")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDisputing(true)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
              >
                Dispute
              </button>
            </div>
          )}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-red-700">{error}</p> : null}
    </div>
  );
}
