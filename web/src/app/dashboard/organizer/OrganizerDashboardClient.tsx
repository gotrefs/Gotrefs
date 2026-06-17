"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SportsFields } from "@/components/SportsFields";
import { SportBadge } from "@/components/SportBadge";
import { ALL_SPORTS, formatEventLocation, formatPayOffer } from "@/data/sports";

type DirectoryRef = {
  id: string;
  displayName: string;
  primarySport: string;
  sportEmoji: string;
  ratePerGame: number | null;
  homeZip: string | null;
  availability: { start_at: string; end_at: string }[];
  maskedEmail: string;
};

type EventRow = {
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
};

type SignupRequestRow = {
  id: string;
  event_id: string;
  ref_member_id: string;
  members: { display_name: string } | { display_name: string }[] | null;
  scheduled_events:
    | { title: string; pay_offer: number | null }
    | { title: string; pay_offer: number | null }[]
    | null;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

/** Parse CSV rows: title,sport,starts_at,ends_at,city,state,zip,officials_needed,pay_offer */
function parseEventsCsv(text: string): Array<{
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  city: string | null;
  state: string | null;
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
    const [title, sport, start, end, col5, col6, col7, col8, col9] = cols;
    const startDate = new Date(start);
    const endDate = new Date(end || start);
    if (Number.isNaN(startDate.getTime())) continue;
    const hasCityState = cols.length >= 9;
    const city = hasCityState ? col5 || null : null;
    const state = hasCityState ? col6 || null : null;
    const zip = hasCityState ? col7 : col5;
    const needed = hasCityState ? col8 : col6;
    const pay = hasCityState ? col9 : col7;
    out.push({
      title: title || "Event",
      sport: sport || "Basketball",
      starts_at: startDate.toISOString(),
      ends_at: (Number.isNaN(endDate.getTime()) ? startDate : endDate).toISOString(),
      city,
      state,
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
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [bio, setBio] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [ratePerOfficial, setRatePerOfficial] = useState("");
  const [idDocPath, setIdDocPath] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [eventsListPath, setEventsListPath] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [eventSport, setEventSport] = useState("Basketball");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [needed, setNeeded] = useState(1);
  const [pay, setPay] = useState("");
  const [notes, setNotes] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [refs, setRefs] = useState<DirectoryRef[]>([]);
  const [canContactRefs, setCanContactRefs] = useState(true);
  const [signupRequests, setSignupRequests] = useState<SignupRequestRow[]>([]);
  const [offerEvent, setOfferEvent] = useState("");
  const [offerRef, setOfferRef] = useState("");
  const [contactRefId, setContactRefId] = useState<string | null>(null);
  const [contactSubject, setContactSubject] = useState("Availability inquiry");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: op } = await supabase
      .from("organizer_profiles")
      .select("bio, primary_sport, additional_sports, rate_per_official, id_document_path, logo_path, events_list_path")
      .eq("member_id", user.id)
      .maybeSingle();

    if (op) {
      setBio(op.bio || "");
      setSport(op.primary_sport || "Basketball");
      setAdditionalSports(Array.isArray(op.additional_sports) ? op.additional_sports : []);
      setRatePerOfficial(op.rate_per_official != null ? String(op.rate_per_official) : "");
      setIdDocPath(op.id_document_path);
      setLogoPath(op.logo_path);
      setEventsListPath(op.events_list_path);
    }

    const { data: ev } = await supabase
      .from("scheduled_events")
      .select("id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer")
      .eq("organizer_member_id", user.id)
      .order("starts_at", { ascending: true });
    setEvents((ev as EventRow[]) || []);

    const { data: sr } = await supabase
      .from("event_signup_requests")
      .select(
        "id, event_id, ref_member_id, members ( display_name ), scheduled_events!inner ( title, pay_offer, organizer_member_id )"
      )
      .eq("scheduled_events.organizer_member_id", user.id)
      .eq("status", "pending");
    setSignupRequests((sr as unknown as SignupRequestRow[]) || []);

    try {
      const dirRes = await fetch("/api/refs/directory");
      const dirJson = (await dirRes.json()) as {
        canContact?: boolean;
        refs?: DirectoryRef[];
      };
      setCanContactRefs(Boolean(dirJson.canContact));
      setRefs(dirJson.refs ?? []);
    } catch {
      setRefs([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearEventFeedback() {
    setEventMsg(null);
    setMsg((prev) => {
      if (!prev) return null;
      const eventRelated = ["Start time", "ZIP", "published", "Could not publish", "Invalid start", "Please fill in"];
      return eventRelated.some((s) => prev.includes(s)) ? null : prev;
    });
  }

  async function ensureOrganizerProfile(userId: string) {
    await supabase.from("organizer_profiles").upsert({ member_id: userId }, { onConflict: "member_id" });
  }

  async function saveProfile() {
    setMsg(null);
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const rateNum = ratePerOfficial === "" ? null : Number(ratePerOfficial);
      const res = await fetch("/api/organizer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          primary_sport: sport,
          additional_sports: additionalSports,
          rate_per_official: Number.isFinite(rateNum as number) ? rateNum : null,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      const text = res.ok ? "Organization profile saved." : json.error || "Could not save profile.";
      setProfileMsg(text);
      setMsg(text);
      if (res.ok) await load();
    } catch {
      const text = "Could not reach the server. Refresh and try again.";
      setProfileMsg(text);
      setMsg(text);
    } finally {
      setSavingProfile(false);
    }
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

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await ensureOrganizerProfile(user.id);
    const path = `${user.id}/organizer_logo_${crypto.randomUUID()}_${sanitizeFilename(file.name)}`;
    const { error: upErr } = await supabase.storage.from("verification_documents").upload(path, file);
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    await supabase.from("organizer_profiles").update({ logo_path: path }).eq("member_id", user.id);
    setLogoPath(path);
    setMsg("Organization logo uploaded.");
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
        await fetch("/api/auth/sync-member", { method: "POST" });
        let imported = 0;
        let lastErr: string | null = null;
        for (const row of parsed) {
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: row.title,
              sport: row.sport,
              starts_at: row.starts_at,
              ends_at: row.ends_at,
              city: row.city,
              state: row.state,
              zip_code: row.zip_code,
              officials_needed: row.officials_needed,
              pay_offer: row.pay_offer,
            }),
          });
          const j = (await res.json()) as { error?: string };
          if (res.ok) imported += 1;
          else lastErr = j.error || "Import failed";
        }
        if (imported === 0) {
          setMsg(`List saved. CSV import failed: ${lastErr ?? "Unknown error"}`);
        } else {
          setMsg(`Uploaded list and imported ${imported} event(s) from CSV.`);
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
    setEventMsg(null);
    const startVal = starts.trim();
    const endVal = ends.trim();
    const zipVal = zip.trim();
    const missing: string[] = [];
    if (!startVal) missing.push("Start time");
    if (!zipVal) missing.push("ZIP code");
    if (missing.length > 0) {
      const text = `Please fill in: ${missing.join(" and ")}.`;
      setEventMsg(text);
      setMsg(text);
      return;
    }
    setPublishing(true);
    try {
      await fetch("/api/auth/sync-member", { method: "POST" });
      const payNum = pay === "" ? null : Number(pay);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Event",
          sport: eventSport,
          starts_at: startVal,
          ends_at: endVal || startVal,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipVal,
          officials_needed: needed,
          pay_offer: Number.isFinite(payNum as number) ? payNum : null,
          notes: notes || null,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        const text = json.error || "Could not publish event.";
        setEventMsg(text);
        setMsg(text);
        return;
      }
      setTitle("");
      setNotes("");
      setStarts("");
      setEnds("");
      setCity("");
      setState("");
      setZip("");
      const text = "Event published.";
      setEventMsg(text);
      setMsg(text);
      await load();
    } catch {
      const text = "Could not reach the server. Refresh and try again.";
      setEventMsg(text);
      setMsg(text);
    } finally {
      setPublishing(false);
    }
  }

  async function sendOfferFromRequest(sr: SignupRequestRow) {
    const ev = Array.isArray(sr.scheduled_events) ? sr.scheduled_events[0] : sr.scheduled_events;
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: sr.event_id,
        refMemberId: sr.ref_member_id,
        offeredPay: ev?.pay_offer ?? null,
      }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(j.error || "Could not send offer.");
      return;
    }
    await supabase
      .from("event_signup_requests")
      .update({ status: "accepted" })
      .eq("id", sr.id);
    setMsg("Offer sent to referee.");
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

  async function sendContact(refId: string) {
    if (!contactMessage.trim()) {
      setMsg("Write a message before contacting the ref.");
      return;
    }
    setContactSending(true);
    try {
      const res = await fetch("/api/refs/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refMemberId: refId,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not send message.");
        return;
      }
      setMsg("Message sent through GotREFS. The ref will see it on their dashboard — their email stays private.");
      setContactRefId(null);
      setContactMessage("");
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setContactSending(false);
    }
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
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Organization ID & logo</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload your organization credential and logo. Files are stored privately in secure storage.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-[var(--blue-text)]">Government ID or league credential</p>
            <p className="text-xs text-[var(--muted)]">JPG, PNG, or PDF</p>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="mt-2 text-sm" onChange={(e) => void uploadId(e)} />
            {idDocPath && <p className="mt-2 text-sm text-green-700">ID on file.</p>}
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--blue-text)]">Organization logo</p>
            <p className="text-xs text-[var(--muted)]">PNG, JPG, or SVG</p>
            <input type="file" accept=".jpg,.jpeg,.png,.svg,.webp" className="mt-2 text-sm" onChange={(e) => void uploadLogo(e)} />
            {logoPath && <p className="mt-2 text-sm text-green-700">Logo on file.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Profile & pay rate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SportsFields
            primarySport={sport}
            additionalSports={additionalSports}
            onPrimaryChange={setSport}
            onAdditionalChange={setAdditionalSports}
          />
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
          disabled={savingProfile}
          onClick={() => void saveProfile()}
          className="mt-4 rounded-lg bg-[var(--blue)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
        {profileMsg && (
          <p
            role="status"
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              profileMsg.includes("saved")
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {profileMsg}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--red)]">Add upcoming event</h2>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createEvent();
          }}
        >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input className="rounded border px-2 py-1" value={title} onChange={(e) => { setTitle(e.target.value); clearEventFeedback(); }} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sport
            <select
              className="rounded border px-2 py-1"
              value={eventSport}
              onChange={(e) => { setEventSport(e.target.value); clearEventFeedback(); }}
            >
              {ALL_SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Start <span className="text-[var(--red)]">*</span>
            <input
              type="datetime-local"
              required
              className="rounded border px-2 py-1"
              value={starts}
              onChange={(e) => { setStarts(e.target.value); clearEventFeedback(); }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End
            <input
              type="datetime-local"
              className="rounded border px-2 py-1"
              value={ends}
              onChange={(e) => { setEnds(e.target.value); clearEventFeedback(); }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            City
            <input
              className="rounded border px-2 py-1"
              placeholder="e.g. Los Angeles"
              value={city}
              onChange={(e) => { setCity(e.target.value); clearEventFeedback(); }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            State
            <input
              className="rounded border px-2 py-1"
              placeholder="e.g. CA"
              value={state}
              onChange={(e) => { setState(e.target.value); clearEventFeedback(); }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            ZIP <span className="text-[var(--red)]">*</span>
            <input
              required
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="e.g. 90210"
              className="rounded border px-2 py-1"
              value={zip}
              onChange={(e) => { setZip(e.target.value); clearEventFeedback(); }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Officials needed
            <input type="number" min={1} className="rounded border px-2 py-1" value={needed} onChange={(e) => { setNeeded(Number(e.target.value)); clearEventFeedback(); }} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pay offer ($)
            <input className="rounded border px-2 py-1" value={pay} onChange={(e) => { setPay(e.target.value); clearEventFeedback(); }} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Notes
          <textarea className="rounded border px-2 py-1" value={notes} onChange={(e) => { setNotes(e.target.value); clearEventFeedback(); }} />
        </label>
        <button
          type="submit"
          disabled={publishing}
          className="mt-4 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {publishing ? "Publishing…" : "Publish event"}
        </button>
        </form>
        {eventMsg && (
          <p
            role="status"
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              eventMsg.includes("published")
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {eventMsg}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Upload events list</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload a CSV or spreadsheet of your season schedule instead of entering events one by one.
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          CSV columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer
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
          {events.map((e) => {
            const loc = formatEventLocation(e.city, e.state, e.zip_code);
            const payLabel = formatPayOffer(e.pay_offer);
            return (
            <li key={e.id} className="rounded border border-[var(--border)] px-3 py-2">
              <strong className="text-[var(--red)]">{e.title}</strong> · {e.sport} ·{" "}
              {new Date(e.starts_at).toLocaleString()}
              {loc ? ` · ${loc}` : ""} · {e.officials_needed} refs
              {payLabel ? ` · Offer ${payLabel}` : ""}
            </li>
            );
          })}
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
              const payLabel = formatPayOffer(ev?.pay_offer);
              return (
                <li key={sr.id} className="flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-3">
                  <div>
                    <p>
                      <strong>{ref?.display_name}</strong> requested <strong>{ev?.title}</strong>
                    </p>
                    {payLabel ? (
                      <p className="mt-1 text-sm font-semibold text-[var(--blue)]">
                        Event offer: {payLabel} per official
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--muted)]">No pay offer set on this event yet.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rounded bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white"
                    onClick={() => void sendOfferFromRequest(sr)}
                  >
                    Send offer{payLabel ? ` (${payLabel})` : ""}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--blue)]">Hire a verified ref</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ref contact info is protected. You can message refs through GotREFS — their real email is never shown.
        </p>
        {!canContactRefs && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Sign up and log in as a registered event organizer to browse ref availability and contact refs.
          </p>
        )}
        {canContactRefs && (
          <>
            <ul className="mt-3 space-y-3 text-sm">
              {refs.slice(0, 20).map((r) => (
                <li key={r.id} className="rounded border border-[var(--border)] px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--navy)]">
                        <SportBadge sport={r.primarySport} className="mr-2" />
                        {r.displayName}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        {r.primarySport}
                        {r.ratePerGame != null ? ` · $${Number(r.ratePerGame).toFixed(0)}/game` : ""}
                        {r.homeZip ? ` · ZIP ${r.homeZip}` : ""}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--slate)]">
                        Contact ref: {r.maskedEmail}
                      </p>
                      {r.availability.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                          {r.availability.slice(0, 3).map((slot) => (
                            <li key={`${slot.start_at}-${slot.end_at}`}>
                              Available {new Date(slot.start_at).toLocaleString()} –{" "}
                              {new Date(slot.end_at).toLocaleString()}
                            </li>
                          ))}
                          {r.availability.length > 3 && (
                            <li>+{r.availability.length - 3} more window(s)</li>
                          )}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--muted)]">No upcoming availability posted.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="text-[var(--red)] underline"
                        onClick={() => setOfferRef(r.id)}
                      >
                        Select for offer
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                        onClick={() => {
                          setContactRefId(contactRefId === r.id ? null : r.id);
                          setContactMessage("");
                        }}
                      >
                        {contactRefId === r.id ? "Cancel" : "Contact ref"}
                      </button>
                    </div>
                  </div>
                  {contactRefId === r.id && (
                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <p className="mb-2 text-xs text-[var(--muted)]">
                        Message goes to the ref&apos;s dashboard only. Email stays hidden ({r.maskedEmail}).
                      </p>
                      <label className="flex flex-col gap-1 text-xs">
                        Subject
                        <input
                          className="rounded border px-2 py-1"
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                        />
                      </label>
                      <label className="mt-2 flex flex-col gap-1 text-xs">
                        Message
                        <textarea
                          className="min-h-[72px] rounded border px-2 py-1"
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="Ask about their availability for your event…"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={contactSending}
                        className="mt-2 rounded-lg bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        onClick={() => void sendContact(r.id)}
                      >
                        {contactSending ? "Sending…" : "Send through GotREFS"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {refs.length === 0 && (
                <li className="text-[var(--muted)]">No verified refs available yet.</li>
              )}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              {offerRef && (
                <p className="w-full text-sm text-[var(--muted)]">
                  Selected ref:{" "}
                  <strong>{refs.find((r) => r.id === offerRef)?.displayName ?? offerRef}</strong>
                </p>
              )}
              <select
                className="rounded border px-2 py-1 text-sm"
                value={offerEvent}
                onChange={(e) => setOfferEvent(e.target.value)}
              >
                <option value="">Your event…</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void sendOffer()}
                className="rounded-lg bg-[var(--blue)] px-4 py-2 text-sm text-white"
              >
                Send offer
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
