"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { formatEventLocation } from "@/data/sports";

export type CalendarEvent = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  city: string | null;
  state: string | null;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
  notes: string | null;
  organizer_member_id?: string;
};

type SignupRequest = {
  event_id: string;
  status: string;
};

type OfferStatus = {
  event_id: string;
  status: string;
};

type BookingStatus = {
  event_id: string;
};

type EventWorkStatus = "confirmed" | "invited" | "applied" | "open";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isMissingPayRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["pay_type", "pay_min", "pay_max"].some((column) => message.includes(column));
}

function formatEventPay(event: CalendarEvent, decimals = 2) {
  if (event.pay_type === "range") {
    const min = event.pay_min ?? event.pay_offer;
    const max = event.pay_max;
    if (min != null && max != null) return `$${Number(min).toFixed(decimals)}-$${Number(max).toFixed(decimals)}`;
    if (min != null) return `$${Number(min).toFixed(decimals)}+`;
  }
  return event.pay_offer != null ? `$${Number(event.pay_offer).toFixed(decimals)}` : "Pay TBD";
}

export function RefEventCalendar({
  embedded = false,
}: {
  canApplyToEvents?: boolean;
  applicationPending?: boolean;
  applicationRejected?: boolean;
  onRequireProfile?: () => void;
  embedded?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [offerStatuses, setOfferStatuses] = useState<OfferStatus[]>([]);
  const [bookingEventIds, setBookingEventIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

    let { data: ev, error: evErr } = await supabase
      .from("scheduled_events")
      .select(
        "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, pay_type, pay_min, pay_max, notes, organizer_member_id"
      )
      .eq("status", "published")
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true });
    if (isMissingPayRangeColumn(evErr)) {
      const fallback = await supabase
        .from("scheduled_events")
        .select(
          "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, notes, organizer_member_id"
        )
        .eq("status", "published")
        .gte("starts_at", start.toISOString())
        .lte("starts_at", end.toISOString())
        .order("starts_at", { ascending: true });
      ev = fallback.data as typeof ev;
      evErr = fallback.error;
    }

    if (evErr) {
      setMsg(evErr.message);
      setEvents([]);
    } else {
      setEvents((ev as CalendarEvent[]) || []);
    }

    const { data: req } = await supabase
      .from("event_signup_requests")
      .select("event_id, status")
      .eq("ref_member_id", user.id);

    setRequests((req as SignupRequest[]) || []);

    const { data: offers } = await supabase
      .from("assignment_offers")
      .select("event_id, status")
      .eq("ref_member_id", user.id);

    setOfferStatuses((offers as OfferStatus[]) || []);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("event_id")
      .eq("ref_member_id", user.id)
      .in("status", ["confirmed", "completed"]);

    setBookingEventIds(new Set((bookings ?? []).map((row) => row.event_id)));
    setLoading(false);
  }, [supabase, cursor]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  function eventWorkStatus(eventId: string): EventWorkStatus {
    if (bookingEventIds.has(eventId)) return "confirmed";
    const offer = offerStatuses.find((row) => row.event_id === eventId);
    if (offer?.status === "pending") return "invited";
    if (offer?.status === "accepted") return "confirmed";
    const request = requests.find((row) => row.event_id === eventId);
    if (request?.status === "pending" || request?.status === "queued") return "applied";
    return "open";
  }

  function eventStatusLabel(status: EventWorkStatus) {
    if (status === "confirmed") return "Confirmed";
    if (status === "invited") return "Invited";
    if (status === "applied") return "Applied";
    return "Open";
  }

  function eventStatusClass(status: EventWorkStatus) {
    if (status === "confirmed") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
    if (status === "invited") return "bg-amber-50 text-amber-800 hover:bg-amber-100";
    if (status === "applied") return "bg-indigo-50 text-indigo-700 hover:bg-indigo-100";
    return "bg-slate-50 text-slate-700 hover:bg-slate-100";
  }

  async function requestSignup(event: CalendarEvent) {
    setMsg(null);
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }

    const existing = eventWorkStatus(event.id);
    if (existing === "applied" || existing === "invited" || existing === "confirmed") {
      setMsg(`You already ${existing === "confirmed" ? "confirmed" : existing} this event.`);
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/events/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id }),
    });
    const json = (await res.json()) as {
      error?: string;
      eventTitle?: string;
      pendingVerification?: boolean;
      status?: string;
    };

    setSubmitting(false);
    if (!res.ok) {
      setMsg(json.error || "Could not send your application.");
      return;
    }
    if (json.pendingVerification) {
      setMsg(
        json.status ||
          "Your status is pending — once GotREFS approves your verification, the organizer will be notified automatically."
      );
    } else {
      setMsg(`✓ Request success for "${json.eventTitle ?? event.title}".`);
    }
    await load();
  }

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <section
      className={
        embedded
          ? "rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
          : "rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ←
        </button>
        <span className="min-w-[10rem] text-center text-sm font-semibold text-[var(--navy)]">{monthLabel}</span>
        <button
          type="button"
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          →
        </button>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${
            msg.startsWith("✓")
              ? "border border-green-200 bg-green-50 text-green-700"
              : "text-[var(--navy)]"
          }`}
        >
          {msg}
        </p>
      )}

      {loading ? (
        <div className="mt-4 h-72 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-[#F1F5F9] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Confirmed
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                Invited
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
                Applied
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden="true" />
                Open
              </span>
            </div>
            <div className="grid grid-cols-7 border-y border-[#F1F5F9] text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-[#F1F5F9]">
              {weeks.flat().map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-28 border-b border-r border-[#F1F5F9] bg-white" />;
                }
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const dayEvents = eventsByDay.get(key) || [];
                const isToday = sameDay(day, new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={key}
                    className={`min-h-28 border-b border-r border-[#F1F5F9] p-1.5 text-left text-xs transition-all duration-200 ${
                      isWeekend ? "bg-slate-50/70" : "bg-white"
                    } ${isToday ? "ring-2 ring-inset ring-[var(--blue)]/30" : ""}`}
                  >
                    <span className="font-semibold text-[var(--navy)]">{day.getDate()}</span>
                    {dayEvents.slice(0, 2).map((ev) => {
                      const status = eventWorkStatus(ev.id);
                      return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelected(ev)}
                        className={`mt-1 block w-full truncate rounded-full px-2 py-1 text-left text-[10px] font-black transition-all duration-200 ${eventStatusClass(status)}`}
                      >
                        {eventStatusLabel(status)} · {formatEventPay(ev, 0)} {ev.sport}
                      </button>
                    );})}
                    {dayEvents.length > 2 && (
                      <span className="px-2 text-[10px] text-[var(--muted)]">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {events.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-8 text-center">
              <p className="text-3xl" aria-hidden="true">
                🗓️
              </p>
              <h3 className="mt-2 font-bold text-[var(--navy)]">No open games this month yet.</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Check back soon or try another month.</p>
            </div>
          )}
        </>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 p-4"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Available gig</p>
                <h3 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">{selected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {selected.sport} · {new Date(selected.starts_at).toLocaleString()} ·{" "}
              {formatEventLocation(selected.city, selected.state, selected.zip_code)}
            </p>
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              {formatEventPay(selected)} per official
            </p>
            <p className="mt-3 text-sm">Officials needed: {selected.officials_needed}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Organizer: GotREFS event organizer</p>
            {selected.notes && <p className="mt-2 text-sm text-[var(--slate)]">{selected.notes}</p>}
            {eventWorkStatus(selected.id) !== "open" && (
              <p className="mt-3 text-sm font-medium text-[var(--blue)]">
                Status: {eventStatusLabel(eventWorkStatus(selected.id))}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting || eventWorkStatus(selected.id) !== "open"}
                onClick={() => void requestSignup(selected)}
                className={`w-full rounded-full px-4 py-3 text-sm font-black text-white transition-all duration-200 disabled:opacity-80 ${
                  eventWorkStatus(selected.id) === "applied"
                    ? "bg-green-600"
                    : "bg-[var(--red)] hover:bg-[var(--red-dark)]"
                }`}
              >
                {eventWorkStatus(selected.id) === "applied"
                  ? "✓ Applied"
                  : eventWorkStatus(selected.id) === "invited"
                    ? "Invited — check My Work"
                    : eventWorkStatus(selected.id) === "confirmed"
                      ? "✓ Confirmed"
                      : submitting
                        ? "Submitting…"
                        : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
