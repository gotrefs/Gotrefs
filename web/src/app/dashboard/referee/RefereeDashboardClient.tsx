"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Screening = {
  status: string;
  summary: string | null;
};

type OfferRow = {
  id: string;
  status: string;
  offered_pay: number | null;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
      }[]
    | null;
};

export default function RefereeDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState<Screening | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [slots, setSlots] = useState<{ id: string; start_at: string; end_at: string }[]>([]);
  const [rate, setRate] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [cert, setCert] = useState("Youth / Recreational");
  const [bio, setBio] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sc } = await supabase
      .from("screening_checks")
      .select("status, summary")
      .eq("ref_member_id", user.id)
      .maybeSingle();
    setScreening(sc);

    const { data: o } = await supabase
      .from("assignment_offers")
      .select(
        "id, status, offered_pay, scheduled_events ( title, sport, starts_at, zip_code )"
      )
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false });
    setOffers((o as unknown as OfferRow[]) || []);

    const { data: av } = await supabase
      .from("ref_availability")
      .select("id, start_at, end_at")
      .eq("ref_member_id", user.id)
      .order("start_at", { ascending: true });
    setSlots(av || []);

    const { data: rp } = await supabase
      .from("ref_profiles")
      .select("rate_per_game, primary_sport, certification_level, bio")
      .eq("member_id", user.id)
      .maybeSingle();
    if (rp) {
      setRate(rp.rate_per_game != null ? String(rp.rate_per_game) : "");
      setSport(rp.primary_sport || "Basketball");
      setCert(rp.certification_level || "Youth / Recreational");
      setBio(rp.bio || "");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const rateNum = rate === "" ? null : Number(rate);
    const { error } = await supabase
      .from("ref_profiles")
      .update({
        rate_per_game: rateNum,
        primary_sport: sport,
        certification_level: cert,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", user.id);
    setMsg(error ? error.message : "Profile saved.");
  }

  async function addSlot() {
    setMsg(null);
    if (!startAt || !endAt) {
      setMsg("Choose start and end times.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("ref_availability").insert({
      ref_member_id: user.id,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setStartAt("");
    setEndAt("");
    await load();
  }

  async function removeSlot(id: string) {
    await supabase.from("ref_availability").delete().eq("id", id);
    await load();
  }

  async function startScreening() {
    setMsg(null);
    setScreeningLoading(true);
    try {
      const res = await fetch("/api/screening/start", { method: "POST" });
      let j: { error?: string; mode?: string; message?: string } = {};
      try {
        j = (await res.json()) as typeof j;
      } catch {
        setMsg("Server error — restart npm run dev and try again.");
        return;
      }
      if (!res.ok) {
        setMsg(j.error || "Could not start screening");
        return;
      }
      setMsg(
        j.mode === "dev_bypass"
          ? "Screening marked clear (development bypass). You can accept offers now."
          : j.mode === "checkr"
            ? "Checkr screening started."
            : j.message || "Screening updated — configure Checkr for live results."
      );
      await load();
    } catch {
      setMsg("Network error — could not reach the server.");
    } finally {
      setScreeningLoading(false);
    }
  }

  async function respondOffer(id: string, action: "accept" | "decline") {
    setMsg(null);
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(j.error || "Could not update offer");
      return;
    }
    setMsg(action === "accept" ? "Offer accepted — booking created." : "Offer declined.");
    await load();
  }

  async function uploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("verification_documents")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    await supabase.from("ref_profiles").update({ verification_doc_path: path }).eq("member_id", user.id);
    setMsg("Verification document uploaded.");
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-[var(--navy)]">Referee dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Set availability and pay, complete screening, then accept offers from organizers.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm text-[var(--navy)] shadow-sm">{msg}</p>}

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Background screening</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          GoTRefs uses a third-party provider (Checkr) to run criminal and other screenings permitted
          under law. You must be <strong>clear</strong> before you can accept paid offers.
        </p>
        <p className="mt-3 text-sm">
          Status:{" "}
          <span className="font-semibold text-[var(--navy)]">{screening?.status || "unknown"}</span>
        </p>
        {screening?.summary && (
          <p className="mt-1 text-xs text-[var(--muted)]">{screening.summary}</p>
        )}
        <button
          type="button"
          disabled={screeningLoading}
          onClick={() => void startScreening()}
          className="mt-4 rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {screeningLoading ? "Updating…" : "Start / refresh screening"}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">ID / certification upload</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Private storage — only you and admins you authorize should access these files.
        </p>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="mt-3 text-sm" onChange={(e) => void uploadDoc(e)} />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Profile & rate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Primary sport
            <input
              className="rounded border border-[var(--border)] px-2 py-1"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Certification level
            <input
              className="rounded border border-[var(--border)] px-2 py-1"
              value={cert}
              onChange={(e) => setCert(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Rate per game ($)
            <input
              type="number"
              min={0}
              className="rounded border border-[var(--border)] px-2 py-1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          Bio
          <textarea
            className="min-h-[80px] rounded border border-[var(--border)] px-2 py-1"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void saveProfile()}
          className="mt-4 rounded-lg bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white"
        >
          Save profile
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Availability</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Start
            <input
              type="datetime-local"
              className="rounded border border-[var(--border)] px-2 py-1"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            End
            <input
              type="datetime-local"
              className="rounded border border-[var(--border)] px-2 py-1"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void addSlot()}
            className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm text-white"
          >
            Add window
          </button>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2">
              <span>
                {new Date(s.start_at).toLocaleString()} → {new Date(s.end_at).toLocaleString()}
              </span>
              <button type="button" className="text-red-600 underline" onClick={() => void removeSlot(s.id)}>
                Remove
              </button>
            </li>
          ))}
          {slots.length === 0 && <li className="text-[var(--muted)]">No availability yet.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Offers</h2>
        <ul className="mt-4 space-y-3">
          {offers.map((o) => {
            const ev = Array.isArray(o.scheduled_events) ? o.scheduled_events[0] : o.scheduled_events;
            return (
            <li key={o.id} className="rounded-lg border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--navy)]">{ev?.title}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {ev?.sport} · {ev?.starts_at && new Date(ev.starts_at).toLocaleString()} · ZIP {ev?.zip_code}
                  </p>
                  <p className="text-sm">
                    Pay offered:{" "}
                    {o.offered_pay != null ? `$${Number(o.offered_pay).toFixed(2)}` : "—"} · Status:{" "}
                    <strong>{o.status}</strong>
                  </p>
                </div>
                {o.status === "pending" && screening?.status === "clear" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-green-600 px-3 py-1 text-sm text-white"
                      onClick={() => void respondOffer(o.id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-3 py-1 text-sm"
                      onClick={() => void respondOffer(o.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {o.status === "pending" && screening?.status !== "clear" && (
                  <p className="text-xs text-amber-700">Complete screening before accepting.</p>
                )}
              </div>
            </li>
            );
          })}
          {offers.length === 0 && <li className="text-[var(--muted)]">No offers yet.</li>}
        </ul>
      </section>
    </div>
  );
}
