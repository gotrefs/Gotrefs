"use client";

import { useEffect, useState } from "react";
import { hoursFromClock, unitLabel, type Timesheet } from "@/lib/timesheets";
import type { BookingForTimesheet } from "@/lib/timesheets-server";

function time(value: string | null) {
  return value ? new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

function dayAndTime(value: string) {
  return new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Clock-out form: games worked (stepper) or hours (pre-filled from the clock). */
function ClockOutForm({
  booking,
  sheet,
  busy,
  onSubmit,
}: {
  booking: BookingForTimesheet;
  sheet: Timesheet;
  busy: boolean;
  onSubmit: (units: number) => void;
}) {
  const isHours = sheet.pay_unit === "hour";
  const start = sheet.worked_units != null
    ? Number(sheet.worked_units)
    : isHours
      ? hoursFromClock(sheet.checked_in_at ?? new Date().toISOString(), sheet.checked_out_at ?? new Date().toISOString())
      : Number(sheet.booked_units);
  const [units, setUnits] = useState(start);
  const step = isHours ? 0.25 : 1;
  const min = isHours ? 1 : 0;

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          {isHours ? "Hours worked" : "Games worked"}{" "}
          <span className="font-normal text-neutral-500">(booked {unitLabel(sheet.pay_unit, Number(sheet.booked_units))})</span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            aria-label={isHours ? "Fewer hours" : "Fewer games"}
            onClick={() => setUnits((u) => Math.max(min, Math.round((u - step) * 4) / 4))}
            className="h-11 w-11 rounded-full border border-neutral-300 text-xl font-semibold text-neutral-800"
          >
            −
          </button>
          <span className="min-w-[5.5rem] text-center text-2xl font-bold text-neutral-900" aria-live="polite">
            {units}
          </span>
          <button
            type="button"
            aria-label={isHours ? "More hours" : "More games"}
            onClick={() => setUnits((u) => Math.min(200, Math.round((u + step) * 4) / 4))}
            className="h-11 w-11 rounded-full border border-neutral-300 text-xl font-semibold text-neutral-800"
          >
            +
          </button>
        </div>
        {isHours ? (
          <p className="mt-1 text-xs text-neutral-500">From the clock, rounded to 15 minutes. Change it if needed.</p>
        ) : null}
        {units !== Number(sheet.booked_units) ? (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Different from the booking, so {booking.refName} will be asked to sign off.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSubmit(units)}
        className="w-full rounded-xl bg-neutral-900 py-3.5 text-base font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : sheet.status === "checked_in" ? `Clock out ${booking.refName}` : "Send updated total"}
      </button>
    </div>
  );
}

/**
 * Shown on the REF's ID card page when it's opened (scanned) by the organizer who booked them:
 * check the REF in, then clock them out with the games or hours worked.
 */
export function ScanCheckInPanel({ gotrefsId }: { gotrefsId: string }) {
  const [bookings, setBookings] = useState<BookingForTimesheet[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/timesheets/scan?gotrefsId=${encodeURIComponent(gotrefsId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { bookings?: BookingForTimesheet[] }) => {
        if (!cancelled) setBookings(json.bookings ?? []);
      })
      .catch(() => {
        // Not logged in as the organizer, or offline: the page is just the ID card.
      });
    return () => {
      cancelled = true;
    };
  }, [gotrefsId]);

  if (bookings.length === 0) return null;

  async function act(booking: BookingForTimesheet, body: Record<string, unknown>) {
    setBusyId(booking.bookingId);
    setError(null);
    try {
      const res = await fetch(`/api/timesheets/${booking.bookingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { timesheet?: Timesheet; error?: string };
      if (!res.ok || !json.timesheet) throw new Error(json.error || "Could not save. Try again.");
      setBookings((prev) => prev.map((b) => (b.bookingId === booking.bookingId ? { ...b, timesheet: json.timesheet! } : b)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Check-in" className="w-full space-y-3">
      {bookings.map((booking) => {
        const sheet = booking.timesheet;
        const busy = busyId === booking.bookingId;
        return (
          <div key={booking.bookingId} className="rounded-2xl bg-white p-4 text-left shadow-lg ring-1 ring-white/20">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Your booking</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{booking.eventTitle}</p>
            <p className="text-sm text-neutral-600">
              {dayAndTime(booking.startsAt)} · {unitLabel(booking.payUnit, booking.bookedUnits)} booked
            </p>

            {!sheet ? (
              <button
                type="button"
                disabled={busy || !booking.inWindow}
                onClick={() => void act(booking, { action: "check_in" })}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? "Checking in…" : booking.inWindow ? `Check in ${booking.refName}` : "Check-in opens 6 hours before start"}
              </button>
            ) : sheet.status === "checked_in" ? (
              <>
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  ✓ Checked in at {time(sheet.checked_in_at)}
                </p>
                <ClockOutForm booking={booking} sheet={sheet} busy={busy} onSubmit={(units) => void act(booking, { action: "clock_out", workedUnits: units })} />
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-neutral-700">
                  {time(sheet.checked_in_at)} – {time(sheet.checked_out_at)} ·{" "}
                  <span className="font-semibold text-neutral-900">{unitLabel(sheet.pay_unit, Number(sheet.worked_units))}</span>
                </p>
                <p
                  className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    sheet.status === "approved"
                      ? "bg-emerald-50 text-emerald-800"
                      : sheet.status === "disputed"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {sheet.status === "approved"
                    ? "✓ Done. Timesheet approved."
                    : sheet.status === "disputed"
                      ? `${booking.refName} disputed this${sheet.dispute_note ? `: "${sheet.dispute_note}"` : ""}. GotREFS will follow up.`
                      : `Waiting for ${booking.refName} to sign off.`}
                </p>
                {sheet.status !== "approved" ? (
                  editing === booking.bookingId ? (
                    <ClockOutForm booking={booking} sheet={sheet} busy={busy} onSubmit={(units) => void act(booking, { action: "clock_out", workedUnits: units })} />
                  ) : (
                    <button type="button" onClick={() => setEditing(booking.bookingId)} className="mt-2 text-sm font-semibold text-neutral-900 underline">
                      Change the total
                    </button>
                  )
                ) : null}
              </>
            )}
          </div>
        );
      })}
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
