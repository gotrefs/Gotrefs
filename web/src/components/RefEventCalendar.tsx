"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CalendarEvent = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  notes: string | null;
  organizer_member_id?: string;
};

type SignupRequest = {
  event_id: string;
  status: string;
};

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function RefEventCalendar() {
  const supabase = useMemo(() => createClient(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
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

    const { data: ev, error: evErr } = await supabase
      .from("scheduled_events")
      .select(
        "id, title, sport, starts_at, ends_at, zip_code, officials_needed, pay_offer, notes, organizer_member_id"
      )
      .eq("status", "published")
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .order("starts_at", { ascending: true });

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
    setLoading(false);
  }, [supabase, cursor]);

  useEffect(() => {
    void load();
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

  function requestStatus(eventId: string) {
    return requests.find((r) => r.event_id === eventId)?.status;
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

    const existing = requestStatus(event.id);
    if (existing === "pending" || existing === "accepted") {
      setMsg("You already requested this event.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("event_signup_requests").upsert(
      {
        event_id: event.id,
        ref_member_id: user.id,
        status: "pending",
        message: "Ref requested via event calendar",
      },
      { onConflict: "event_id,ref_member_id" }
    );

    setSubmitting(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(`Request sent for "${event.title}". The organizer can follow up with an offer.`);
    await load();
  }

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--navy)]">Upcoming events</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Published games from all organizers. Click a day with events, then request to work that game.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--border)] px-3 py-1 text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-[var(--navy)]">
            {monthLabel}
          </span>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-3 py-1 text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            →
          </button>
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-[var(--navy)]">{msg}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Loading calendar…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.flat().map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[4.5rem] rounded bg-transparent" />;
              }
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const dayEvents = eventsByDay.get(key) || [];
              const isToday = sameDay(day, new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => dayEvents[0] && setSelected(dayEvents[0])}
                  className={`min-h-[4.5rem] rounded border p-1 text-left text-xs transition ${
                    dayEvents.length
                      ? "border-[var(--red)]/40 bg-[var(--red-light)] hover:border-[var(--red)]"
                      : "border-[var(--border)] bg-[var(--bg)]"
                  } ${isToday ? "ring-2 ring-[var(--blue)]/30" : ""}`}
                >
                  <span className="font-semibold text-[var(--navy)]">{day.getDate()}</span>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={ev.id}
                      className="mt-0.5 block truncate rounded bg-[var(--blue)]/10 px-1 text-[10px] text-[var(--blue)]"
                    >
                      {ev.sport}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-[var(--muted)]">+{dayEvents.length - 2} more</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="font-display text-xl font-bold text-[var(--navy)]">{selected.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {selected.sport} · {new Date(selected.starts_at).toLocaleString()} · ZIP {selected.zip_code}
            </p>
            <p className="mt-1 text-sm">
              Officials needed: {selected.officials_needed}
              {selected.pay_offer != null && ` · Pay: $${Number(selected.pay_offer).toFixed(2)}`}
            </p>
            {selected.notes && <p className="mt-2 text-sm text-[var(--slate)]">{selected.notes}</p>}
            {requestStatus(selected.id) && (
              <p className="mt-3 text-sm font-medium text-[var(--blue)]">
                Your request: {requestStatus(selected.id)}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting || requestStatus(selected.id) === "pending"}
                onClick={() => void requestSignup(selected)}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {requestStatus(selected.id) === "pending" ? "Request pending" : "Request to work this event"}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
