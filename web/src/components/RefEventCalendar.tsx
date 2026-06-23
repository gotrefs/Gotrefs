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

function formatOpportunityDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function searchableText(...values: Array<string | number | null | undefined>) {
  return values
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase())
    .join(" ");
}

export function RefEventCalendar({
  canApplyToEvents = true,
  onRequireProfile,
}: {
  canApplyToEvents?: boolean;
  onRequireProfile?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
  const [magicSearch, setMagicSearch] = useState("");
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
        "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, notes, organizer_member_id"
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
    queueMicrotask(() => void load());
  }, [load]);

  const normalizedMagicSearch = magicSearch.trim().toLowerCase();
  const filteredEvents = useMemo(() => {
    if (!normalizedMagicSearch) return events;
    const terms = normalizedMagicSearch.split(/\s+/);
    const ignoredTerms = new Set(["find", "a", "game", "paying", "this", "weekend", "near"]);
    return events.filter((event) => {
      const text = searchableText(
        event.title,
        event.sport,
        event.city,
        event.state,
        event.zip_code,
        event.pay_offer != null ? `$${event.pay_offer}` : "",
        formatOpportunityDate(event.starts_at),
        event.notes
      );
      const minPayMatch = normalizedMagicSearch.match(/\$?(\d+)\+?/);
      const meetsPay = minPayMatch ? Number(event.pay_offer ?? 0) >= Number(minPayMatch[1]) : true;
      return meetsPay && terms.every((term) => ignoredTerms.has(term) || /^\$?\d+\+?$/.test(term) || text.includes(term));
    });
  }, [events, normalizedMagicSearch]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      const d = new Date(ev.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [filteredEvents]);

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
    if (!canApplyToEvents) {
      setMsg("Finish your referee profile first so organizers know who is applying.");
      onRequireProfile?.();
      return;
    }
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
    <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Job board</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[var(--navy)]">
            Open Refereeing Opportunities
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Browse open games posted by organizers and apply to work the ones that fit your schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[var(--border)] bg-[var(--grey-light)] p-1">
            {(["cards", "calendar"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-3 py-1.5 text-xs font-black capitalize transition-all duration-200 ${
                  viewMode === mode
                    ? "bg-white text-[var(--navy)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--navy)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-[var(--navy)]">
            {monthLabel}
          </span>
          <button
            type="button"
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            →
          </button>
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-[var(--navy)]">{msg}</p>}

      <label className="mt-5 block">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Magic search</span>
        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition-all duration-200 focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[var(--blue)]/15 sm:flex-row sm:items-center">
          <span className="px-2 text-lg" aria-hidden="true">🔎</span>
          <input
            value={magicSearch}
            onChange={(e) => setMagicSearch(e.target.value)}
            placeholder="Find a game... Soccer paying $25+ this weekend"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-semibold text-[var(--navy)] outline-none placeholder:text-slate-400"
          />
          <div className="flex flex-wrap gap-2">
            {["Soccer", "Paying $25+", "This Weekend"].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setMagicSearch((current) => `${current} ${chip}`.trim())}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-[var(--navy)] hover:text-white"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </label>

      {loading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className={`mt-5 grid gap-4 transition-opacity duration-200 md:grid-cols-2 ${viewMode === "calendar" ? "hidden" : ""}`}>
            {filteredEvents.slice(0, 6).map((event) => {
              const status = requestStatus(event.id);
              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-[var(--blue)]/10 px-3 py-1 text-xs font-bold text-[var(--blue)]">
                        {event.sport}
                      </span>
                      <h3 className="mt-3 font-black text-[var(--navy)]">{event.title}</h3>
                    </div>
                    <p className="text-right text-sm font-black text-emerald-700">
                      {event.pay_offer != null ? `$${Number(event.pay_offer).toFixed(2)}` : "Pay TBD"}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-[var(--slate)]">
                    <p>📅 {formatOpportunityDate(event.starts_at)}</p>
                    <p>📍 {formatEventLocation(event.city, event.state, event.zip_code)}</p>
                    <p>👥 {event.officials_needed} official{event.officials_needed === 1 ? "" : "s"} needed</p>
                  </div>
                  {event.notes && <p className="mt-3 text-sm text-[var(--muted)]">{event.notes}</p>}
                  <button
                    type="button"
                    disabled={submitting || status === "pending" || status === "accepted"}
                    onClick={() => void requestSignup(event)}
                    className="mt-5 w-full rounded-full bg-[var(--red)] px-4 py-2.5 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--red-dark)] disabled:opacity-50"
                  >
                    {status === "pending" ? "Application sent" : status === "accepted" ? "Accepted" : "Apply to Ref"}
                  </button>
                </article>
              );
            })}
          </div>
          {filteredEvents.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-8 text-center">
              <p className="text-3xl" aria-hidden="true">🗓️</p>
              <h3 className="mt-2 font-bold text-[var(--navy)]">
                {events.length === 0 ? "No open games this month yet." : "No games match that search yet."}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Try another sport, pay range, or date window.</p>
            </div>
          )}

          <div className={`mt-5 rounded-2xl border border-[#F1F5F9] bg-white p-4 transition-all duration-200 ${viewMode === "cards" ? "hidden" : ""}`}>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
                Available open games
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Booked / accepted games
              </span>
            </div>
          <div className="grid grid-cols-7 border-y border-[#F1F5F9] text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">{d}</div>
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
                  {dayEvents.slice(0, 2).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelected(ev)}
                      className={`mt-1 block w-full truncate rounded-full px-2 py-1 text-left text-[10px] font-black transition-all duration-200 ${
                        requestStatus(ev.id) === "accepted"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {requestStatus(ev.id) === "accepted" ? "Booked" : "Available Gig"} ·{" "}
                      {ev.pay_offer != null ? `$${Number(ev.pay_offer).toFixed(0)}` : "Pay TBD"} {ev.sport}
                    </button>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="px-2 text-[10px] text-[var(--muted)]">+{dayEvents.length - 2} more</span>
                  )}
                </div>
              );
            })}
          </div>
          </div>
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
              {selected.pay_offer != null ? `$${Number(selected.pay_offer).toFixed(2)} per official` : "Pay TBD"}
            </p>
            <p className="mt-3 text-sm">
              Officials needed: {selected.officials_needed}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">Organizer: GotREFS event organizer</p>
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
                className="w-full rounded-full bg-[var(--red)] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--red-dark)] disabled:opacity-50"
              >
                {requestStatus(selected.id) === "pending" ? "Request pending" : "Request to Work Game"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
