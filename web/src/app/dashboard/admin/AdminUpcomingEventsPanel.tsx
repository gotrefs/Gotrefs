"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminEventRef, AdminUpcomingEvent } from "@/lib/admin/upcoming-events";

const PREVIEW_EVENTS = 10;

const KIND_STYLE: Record<AdminEventRef["kind"], { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-emerald-100 text-emerald-800" },
  invited: { label: "Invited", className: "bg-sky-100 text-sky-800" },
  requested: { label: "Requested", className: "bg-amber-100 text-amber-800" },
};

const SHEET_LABEL: Record<NonNullable<AdminEventRef["timesheetStatus"]>, string> = {
  checked_in: "Checked in",
  awaiting_ref: "Clocked out · waiting on REF",
  approved: "Timesheet approved",
  disputed: "Timesheet disputed",
};

function when(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${day} · ${t(s)} – ${t(e)}`
    : `${day} ${t(s)} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${t(e)}`;
}

function RefRow({ refRow }: { refRow: AdminEventRef }) {
  const kind = KIND_STYLE[refRow.kind];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 py-2 text-sm first:border-t-0">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${kind.className}`}>{kind.label}</span>
      <span className="font-medium text-neutral-900">{refRow.name}</span>
      {refRow.gotrefsId ? <span className="text-xs text-neutral-500">{refRow.gotrefsId}</span> : null}
      <span className="text-neutral-600">{refRow.phone || "no phone"}</span>
      <span className="break-all text-neutral-600">{refRow.email || "no email"}</span>
      {refRow.games ? <span className="text-neutral-500">{refRow.games} game{refRow.games === 1 ? "" : "s"}</span> : null}
      {refRow.pay != null ? <span className="text-neutral-500">${refRow.pay} rate</span> : null}
      {refRow.timesheetStatus ? (
        <span className="text-xs font-medium text-neutral-700">· {SHEET_LABEL[refRow.timesheetStatus]}</span>
      ) : null}
    </li>
  );
}

/** Admin: events coming up, who's running them, and the REFS on each one. */
export default function AdminUpcomingEventsPanel() {
  const [events, setEvents] = useState<AdminUpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [onlyShort, setOnlyShort] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/upcoming-events", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { events?: AdminUpcomingEvent[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load events.");
        return json.events ?? [];
      })
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load events.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      const booked = ev.refs.filter((r) => r.kind === "booked").length;
      if (onlyShort && booked >= ev.refsNeeded) return false;
      if (!q) return true;
      const hay = [ev.title, ev.sport, ev.place, ev.organizer.name, ev.organizer.organization, ...ev.refs.map((r) => r.name)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, search, onlyShort]);

  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_EVENTS);

  return (
    <section className="mb-10 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Upcoming events</h2>
          <p className="text-sm text-neutral-500">
            {loading ? "Loading…" : `${events.length} event${events.length === 1 ? "" : "s"} coming up, soonest first.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} />
            Still needs REFS
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event, organizer, REF…"
            className="w-64 max-w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">
          No upcoming events{search || onlyShort ? " match these filters" : ""}.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {visible.map((ev) => {
          const booked = ev.refs.filter((r) => r.kind === "booked").length;
          const full = booked >= ev.refsNeeded;
          return (
            <article key={ev.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900">
                    {ev.title}
                    {ev.status === "draft" ? (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">Draft</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-neutral-600">
                    {[ev.sport, when(ev.startsAt, ev.endsAt)].filter(Boolean).join(" · ")}
                  </p>
                  {ev.place ? <p className="text-sm text-neutral-500">{ev.place}</p> : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    full ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"
                  }`}
                >
                  {booked} of {ev.refsNeeded} REFS booked
                </span>
              </div>
              <p className="mt-2 text-sm text-neutral-700">
                <span className="font-medium">Organizer:</span> {ev.organizer.name}
                {ev.organizer.organization ? ` (${ev.organizer.organization})` : ""}
                {" · "}
                {ev.organizer.phone || "no phone"}
                {" · "}
                <span className="break-all">{ev.organizer.email || "no email"}</span>
              </p>
              {ev.refs.length > 0 ? (
                <ul className="mt-2 rounded-lg bg-neutral-50 px-3">
                  {ev.refs.map((r) => (
                    <RefRow key={`${r.kind}-${r.memberId}`} refRow={r} />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">No REFS booked, invited or requested yet.</p>
              )}
            </article>
          );
        })}
      </div>

      {filtered.length > PREVIEW_EVENTS ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 text-sm font-semibold text-emerald-700 hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${filtered.length} events`}
        </button>
      ) : null}
    </section>
  );
}
