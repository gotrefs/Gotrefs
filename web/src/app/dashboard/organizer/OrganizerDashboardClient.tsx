"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type RefRow = {
  id: string;
  display_name: string;
  home_zip: string | null;
  ref_profiles:
    | { primary_sport: string; rate_per_game: number | null }
    | { primary_sport: string; rate_per_game: number | null }[]
    | null;
};

type SignupRequestRow = {
  id: string;
  members: { display_name: string } | { display_name: string }[] | null;
  scheduled_events: { title: string } | { title: string }[] | null;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

/** Parse CSV rows: title,sport,starts_at,ends_at,zip,officials_needed,pay_offer */
function parseEventsCsv(text: string): Array<{
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
}> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  const out: ReturnType<typeof parseEventsCsv> = [];
  for (const line of rows) {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 5) continue;
    const [title, sport, start, end, zip, needed, pay] = cols;
    const startDate = new Date(start);
    const endDate = new Date(end || start);
    if (Number.isNaN(startDate.getTime())) continue;
    out.push({
      title: title || "Event",
      sport: sport || "Basketball",
      starts_at: startDate.toISOString(),
      ends_at: (Number.isNaN(endDate.getTime()) ? startDate : endDate).toISOString(),
      zip_code: zip || "00000",
      officials_needed: Math.max(1, Number(needed) || 1),
      pay_offer: pay && Number.isFinite(Number(pay)) ? Number(pay) : null,
    });
  }
  return out;
}

export default function OrganizerDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [bio, setBio] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [ratePerOfficial, setRatePerOfficial] = useState("");
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [eventsListPath, setEventsListPath] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [eventSport, setEventSport] = useState("Basketball");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [zip, setZip] = useState("");
  const [needed, setNeeded] = useState(1);
  const [pay, setPay] = useState("");
  const [notes, setNotes] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequestRow[]>([]);
  const [offerEvent, setOfferEvent] = useState("");
  const [offerRef, setOfferRef] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: op } = await supabase
      .from("organizer_profiles")
      .select("bio, primary_sport, rate_per_official, id_document_path, events_list_path")
      .eq("member_id", user.id)
      .maybeSingle();

    if (op) {
      setBio(op.bio || "");
      setSport(op.primary_sport || "Basketball");
      setRatePerOfficial(op.rate_per_official != null ? String(op.rate_per_official) : "");
      setIdDocPath(op.id_document_path);
      setEventsListPath(op.events_list_path);
    }

    const { data: ev } = await supabase
      .from("scheduled_events")
      .select("id, title, sport, starts_at, ends_at, zip_code, officials_needed, pay_offer")
      .eq("organizer_member_id", user.id)
      .order("starts_at", { ascending: true });
    setEvents((ev as EventRow[]) || []);

    const { data: sr } = await supabase
      .from("event_signup_requests")
      .select(
        "id, status, members ( display_name ), scheduled_events!inner ( title, organizer_member_id )"
      )
      .eq("scheduled_events.organizer_member_id", user.id)
      .eq("status", "pending");
    setSignupRequests((sr as unknown as SignupRequestRow[]) || []);

    const { data: r } = await supabase
      .from("members")
      .select("id, display_name, home_zip, ref_profiles ( primary_sport, rate_per_game )")
      .eq("role", "ref");
    setRefs((r as unknown as RefRow[]) || []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureOrganizerProfile(userId: string) {
    await supabase.from("organizer_profiles").upsert({ member_id: userId }, { onConflict: "member_id" });
  }

  async function saveProfile() {
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await ensureOrganizerProfile(user.id);
    const rateNum = ratePerOfficial === "" ? null : Number(ratePerOfficial);
    const { error } = await supabase
      .from("organizer_profiles")
      .update({
        bio,
        primary_sport: sport,
        rate_per_official: Number.isFinite(rateNum as number) ? rateNum : null,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", user.id);
    setMsg(error ? error.message : "Organization profile saved.");
  }

  async function uploadId(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await ensureOrganizerProfile(user.id);
    const path = `${user.id}/organizer_id_${crypto.randomUUID()}_${sanitizeFilename(file.name)}`;
    const { error: upErr } = await supabase.storage.from("verification_documents").upload(path, file);
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    await supabase.from("organizer_profiles").update({ id_document_path: path }).eq("member_id", user.id);
    setIdDocPath(path);
    setMsg("ID document uploaded.");
  }

  async function uploadEventsList(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await ensureOrganizerProfile(user.id);

    const path = `${user.id}/events_list_${crypto.randomUUID()}_${sanitizeFilename(file.name)}`;
    const { error: upErr } = await supabase.storage.from("verification_documents").upload(path, file);
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    await supabase.from("organizer_profiles").update({ events_list_path: path }).eq("member_id", user.id);
    setEventsListPath(path);

    if (file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv") || file.type.includes("text")) {
      const text = await file.text();
      const parsed = parseEventsCsv(text);
      if (parsed.length > 0) {
        const rows = parsed.map((row) => ({
          organizer_member_id: user.id,
          ...row,
          notes: null,
          status: "published" as const,
        }));
        const { error: insErr } = await supabase.from("scheduled_events").insert(rows);
        if (insErr) {
          setMsg(`List saved. CSV import failed: ${insErr.message}`);
        } else {
          setMsg(`Uploaded list and imported ${parsed.length} event(s) from CSV.`);
        }
        await load();
        return;
      }
    }
    setMsg("Events list uploaded. Use CSV (title,sport,starts_at,ends_at,zip,officials_needed,pay) to bulk-import.");
    await load();
  }

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
      sport: eventSport,
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
    setMsg("Event added to your schedule.");
    await load();
  }

  async function sendOffer() {
    if (!offerEvent || !offerRef) {
      setMsg("Pick an event and a referee (click Select next to a ref, then choose your event).");
      return;
    }
    const event = events.find((e) => e.id === offerEvent);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: offerEvent,
        refMemberId: offerRef,
        offeredPay: event?.pay_offer ?? null,
      }),
    });
    const j = (await res.json()) as { error?: string };
    setMsg(res.ok ? "Offer sent to referee." : j.error || "Could not send offer");
    if (res.ok) {
      setOfferRef("");
      setOfferEvent("");
    }
    await load();
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading organizer dashboard…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-[var(--blue)]/20 bg-gradient-to-r from-[var(--blue)]/5 to-[var(--red)]/5 p-6">
        <h1 className="font-display text-3xl font-bold text-[var(--blue)]">Organizer dashboard</h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Manage your organization, post upcoming events, upload your schedule, and hire verified refs.
        </p>
      </div>

      {msg && (
        <p className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--navy)]">
          {msg}
        </p>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Organization ID</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Upload a government ID or league credential (JPG, PNG, PDF).</p>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="mt-3 text-sm" onChange={(e) => void uploadId(e)} />
        {idDocPath && <p className="mt-2 text-sm text-green-700">ID on file.</p>}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Profile & pay rate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Primary sport
            <input className="rounded border border-[var(--border)] px-2 py-1" value={sport} onChange={(e) => setSport(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Typical pay per official ($)
            <input
              type="number"
              min={0}
              className="rounded border border-[var(--border)] px-2 py-1"
              value={ratePerOfficial}
              onChange={(e) => setRatePerOfficial(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          About your organization
          <textarea
            className="min-h-[80px] rounded border border-[var(--border)] px-2 py-1"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveProfile()}
          className="mt-4 rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-medium text-white"
        >
          Save profile
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--red)]">Add upcoming event</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input className="rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sport
            <input className="rounded border px-2 py-1" value={eventSport} onChange={(e) => setEventSport(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Start
            <input type="datetime-local" className="rounded border px-2 py-1" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End
            <input type="datetime-local" className="rounded border px-2 py-1" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ZIP
            <input className="rounded border px-2 py-1" value={zip} onChange={(e) => setZip(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Officials needed
            <input type="number" min={1} className="rounded border px-2 py-1" value={needed} onChange={(e) => setNeeded(Number(e.target.value))} />
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
        <button type="button" onClick={() => void createEvent()} className="mt-4 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-medium text-white">
          Publish event
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Upload events list</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload a CSV or spreadsheet of your season schedule instead of entering events one by one.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          CSV columns: title, sport, starts_at, ends_at, zip, officials_needed, pay_offer
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-3 text-sm"
          onChange={(e) => void uploadEventsList(e)}
        />
        {eventsListPath && <p className="mt-2 text-sm text-green-700">Events list file saved.</p>}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Your upcoming events</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Only events you posted appear here — other organizers cannot see these.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="rounded border border-[var(--border)] px-3 py-2">
              <strong className="text-[var(--red)]">{e.title}</strong> · {e.sport} ·{" "}
              {new Date(e.starts_at).toLocaleString()} · ZIP {e.zip_code} · {e.officials_needed} refs
              {e.pay_offer != null ? ` · $${Number(e.pay_offer).toFixed(2)}` : ""}
            </li>
          ))}
          {events.length === 0 && <li className="text-[var(--muted)]">No upcoming events yet.</li>}
        </ul>
      </section>

      {signupRequests.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-[var(--red)]">Ref requests on your events</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Referees who requested to work one of your events. Only you see these — not other organizers.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {signupRequests.map((sr) => {
              const ref = Array.isArray(sr.members) ? sr.members[0] : sr.members;
              const ev = Array.isArray(sr.scheduled_events) ? sr.scheduled_events[0] : sr.scheduled_events;
              return (
                <li key={sr.id} className="rounded border px-3 py-2">
                  <strong>{ref?.display_name}</strong> → {ev?.title}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Hire a verified ref</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {refs.slice(0, 12).map((r) => {
            const rp = Array.isArray(r.ref_profiles) ? r.ref_profiles[0] : r.ref_profiles;
            return (
              <li key={r.id} className="flex justify-between gap-2 rounded border px-3 py-2">
                <span>
                  {r.display_name} · {rp?.primary_sport}
                  {rp?.rate_per_game != null ? ` · $${Number(rp.rate_per_game).toFixed(0)}/game` : ""}
                </span>
                <button type="button" className="text-[var(--red)] underline" onClick={() => setOfferRef(r.id)}>
                  Select
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          {offerRef && (
            <p className="w-full text-sm text-[var(--muted)]">
              Selected ref: <strong>{refs.find((r) => r.id === offerRef)?.display_name ?? offerRef}</strong>
            </p>
          )}
          <select className="rounded border px-2 py-1 text-sm" value={offerEvent} onChange={(e) => setOfferEvent(e.target.value)}>
            <option value="">Your event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void sendOffer()} className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm text-white">
            Send offer
          </button>
        </div>
      </section>
    </div>
  );
}
