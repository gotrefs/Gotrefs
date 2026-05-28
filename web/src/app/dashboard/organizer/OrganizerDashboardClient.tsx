"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RefRow = {
  id: string;
  display_name: string;
  home_zip: string | null;
  ref_profiles:
    | {
        primary_sport: string;
        certification_level: string | null;
        rate_per_game: number | null;
      }
    | {
        primary_sport: string;
        certification_level: string | null;
        rate_per_game: number | null;
      }[]
    | null;
};

type EventRow = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
};

type OfferOut = {
  id: string;
  status: string;
  offered_pay: number | null;
  ref_member_id: string;
  event_id: string;
};

type BookingRow = {
  id: string;
  status: string;
  ref_member_id: string;
  scheduled_events: { title: string } | { title: string }[] | null;
};

export default function OrganizerDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [offers, setOffers] = useState<OfferOut[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [zip, setZip] = useState("");
  const [needed, setNeeded] = useState(1);
  const [pay, setPay] = useState("");
  const [notes, setNotes] = useState("");

  const [offerEvent, setOfferEvent] = useState("");
  const [offerRef, setOfferRef] = useState("");
  const [offerPay, setOfferPay] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: r } = await supabase
      .from("members")
      .select("id, display_name, home_zip, ref_profiles ( primary_sport, certification_level, rate_per_game )")
      .eq("role", "ref");
    setRefs((r as unknown as RefRow[]) || []);

    const { data: ev } = await supabase
      .from("scheduled_events")
      .select("id, title, sport, starts_at, ends_at, zip_code, officials_needed, pay_offer")
      .order("starts_at", { ascending: true });
    setEvents((ev as EventRow[]) || []);

    const evIds = (ev || []).map((e) => e.id);
    if (evIds.length) {
      const { data: o } = await supabase.from("assignment_offers").select("*").in("event_id", evIds);
      setOffers((o as OfferOut[]) || []);
    } else {
      setOffers([]);
    }

    const { data: b } = await supabase
      .from("bookings")
      .select("id, status, ref_member_id, scheduled_events ( title )")
      .eq("organizer_member_id", user.id);
    setBookings((b as unknown as BookingRow[]) || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEvent() {
    setMsg(null);
    if (!starts || !ends || !zip) {
      setMsg("Start, end, and ZIP are required.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const payNum = pay === "" ? null : Number(pay);
    const { error } = await supabase.from("scheduled_events").insert({
      organizer_member_id: user.id,
      title: title || "Event",
      sport,
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(ends).toISOString(),
      zip_code: zip,
      officials_needed: needed,
      pay_offer: Number.isFinite(payNum as number) ? payNum : null,
      notes: notes || null,
      status: "published",
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setTitle("");
    setNotes("");
    setMsg("Event created.");
    await load();
  }

  async function sendOffer() {
    setMsg(null);
    if (!offerEvent || !offerRef) {
      setMsg("Pick an event and a referee.");
      return;
    }
    const payVal = offerPay === "" ? null : Number(offerPay);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: offerEvent,
        refMemberId: offerRef,
        offeredPay: payVal,
      }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(j.error || "Could not send offer");
      return;
    }
    setMsg("Offer sent.");
    await load();
  }

  async function cancelOffer(id: string) {
    setMsg(null);
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(j.error || "Could not cancel");
      return;
    }
    setMsg("Offer canceled.");
    await load();
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--navy)]">Organizer dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Post events, browse screened referees, send offers, and track confirmations.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm shadow-sm">{msg}</p>}

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">New event</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input className="rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sport
            <input className="rounded border px-2 py-1" value={sport} onChange={(e) => setSport(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Start
            <input
              type="datetime-local"
              className="rounded border px-2 py-1"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End
            <input
              type="datetime-local"
              className="rounded border px-2 py-1"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ZIP
            <input className="rounded border px-2 py-1" value={zip} onChange={(e) => setZip(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Officials needed
            <input
              type="number"
              min={1}
              className="rounded border px-2 py-1"
              value={needed}
              onChange={(e) => setNeeded(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pay offer ($)
            <input className="rounded border px-2 py-1" value={pay} onChange={(e) => setPay(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Notes
          <textarea className="rounded border px-2 py-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => void createEvent()}
          className="mt-4 rounded-lg bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white"
        >
          Save event
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Your events</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-[var(--border)] px-3 py-2">
              <strong>{e.title}</strong> · {e.sport} · {new Date(e.starts_at).toLocaleString()} · ZIP {e.zip_code}{" "}
              · refs needed: {e.officials_needed}
              {e.pay_offer != null ? ` · $${Number(e.pay_offer).toFixed(2)}` : ""}
            </li>
          ))}
          {events.length === 0 && <li className="text-[var(--muted)]">No events yet.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Verified referees</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Only referees with a <strong>clear</strong> third-party screening appear here.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {refs.map((r) => {
            const rp = Array.isArray(r.ref_profiles) ? r.ref_profiles[0] : r.ref_profiles;
            return (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded border border-[var(--border)] px-3 py-2">
              <span>
                <strong>{r.display_name}</strong> · {rp?.primary_sport}{" "}
                {rp?.rate_per_game != null
                  ? `· $${Number(rp.rate_per_game).toFixed(2)}/game`
                  : ""}{" "}
                · ZIP {r.home_zip || "—"}
              </span>
              <button
                type="button"
                className="text-[var(--orange)] underline"
                onClick={() => {
                  setOfferRef(r.id);
                  setMsg(`Selected ref: ${r.display_name}`);
                }}
              >
                Select for offer
              </button>
            </li>
            );
          })}
          {refs.length === 0 && <li className="text-[var(--muted)]">No screened refs visible yet.</li>}
        </ul>

        <h3 className="mt-8 font-display text-lg font-bold text-[var(--navy)]">Send offer</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex flex-col gap-1 text-sm">
            Event
            <select
              className="rounded border px-2 py-1"
              value={offerEvent}
              onChange={(e) => setOfferEvent(e.target.value)}
            >
              <option value="">Choose…</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {new Date(e.starts_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ref (user id)
            <input
              className="rounded border px-2 py-1 font-mono text-xs"
              value={offerRef}
              onChange={(e) => setOfferRef(e.target.value)}
              placeholder="Select from list above"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Offered pay ($)
            <input className="rounded border px-2 py-1" value={offerPay} onChange={(e) => setOfferPay(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={() => void sendOffer()}
            className="self-end rounded-lg bg-[var(--navy)] px-4 py-2 text-sm text-white"
          >
            Send offer
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Offers you sent</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
              <span>
                Event <code className="text-xs">{o.event_id.slice(0, 8)}…</code> → ref{" "}
                <code className="text-xs">{o.ref_member_id.slice(0, 8)}…</code> · {o.status}
                {o.offered_pay != null ? ` · $${Number(o.offered_pay).toFixed(2)}` : ""}
              </span>
              {o.status === "pending" && (
                <button type="button" className="text-red-600 underline" onClick={() => void cancelOffer(o.id)}>
                  Cancel
                </button>
              )}
            </li>
          ))}
          {offers.length === 0 && <li className="text-[var(--muted)]">No offers yet.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Confirmed bookings</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {bookings.map((b) => {
            const ev = Array.isArray(b.scheduled_events) ? b.scheduled_events[0] : b.scheduled_events;
            return (
            <li key={b.id} className="rounded border px-3 py-2">
              {ev?.title || "Event"} · ref <code className="text-xs">{b.ref_member_id}</code> · {b.status}
            </li>
            );
          })}
          {bookings.length === 0 && <li className="text-[var(--muted)]">No confirmations yet.</li>}
        </ul>
      </section>
    </div>
  );
}
