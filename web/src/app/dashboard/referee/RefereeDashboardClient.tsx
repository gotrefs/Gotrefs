"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { RefEventCalendar } from "@/components/RefEventCalendar";
import { SportsFields } from "@/components/SportsFields";
import { VerificationUploadField } from "@/components/VerificationUploadField";
import { formatEventLocation } from "@/data/sports";
import { BRAND_NAME } from "@/lib/brand";
import { refOfferEligible } from "@/lib/ref-eligibility";

type InquiryRow = {
  id: string;
  subject: string;
  message: string;
  created_at: string;
  organizer_member_id: string;
  members: { display_name: string } | { display_name: string }[] | null;
};

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
        city: string | null;
        state: string | null;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
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
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [cert, setCert] = useState("Youth / Recreational");
  const [bio, setBio] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"checkr" | "external">("checkr");
  const [externalCompany, setExternalCompany] = useState("");
  const [externalProofPath, setExternalProofPath] = useState<string | null>(null);
  const [govIdPath, setGovIdPath] = useState<string | null>(null);
  const [certDocPath, setCertDocPath] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>("draft");
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [isAssignor, setIsAssignor] = useState(false);
  const [assignorSaving, setAssignorSaving] = useState(false);
  const [rosterEntries, setRosterEntries] = useState<AssignorRosterEntry[]>([]);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);

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
        "id, status, offered_pay, scheduled_events ( title, sport, starts_at, zip_code, city, state )"
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
      .select(
        "rate_per_game, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
      )
      .eq("member_id", user.id)
      .maybeSingle();
    if (rp) {
      setRate(rp.rate_per_game != null ? String(rp.rate_per_game) : "");
      setSport(rp.primary_sport || "Basketball");
      setAdditionalSports(Array.isArray(rp.additional_sports) ? rp.additional_sports : []);
      setIsAssignor(Boolean(rp.is_assignor));
      setCert(rp.certification_level || "Youth / Recreational");
      setBio(rp.bio || "");
      setVerificationMethod(
        rp.verification_method === "external" ? "external" : "checkr"
      );
      setExternalCompany(rp.external_verifier_name || "");
      setExternalProofPath(rp.external_verification_proof_path || null);
      setGovIdPath(rp.government_id_path || rp.verification_doc_path || null);
      setCertDocPath(rp.certification_document_path || null);
    }

    const { data: vs } = await supabase
      .from("ref_verification_submissions")
      .select("status")
      .eq("ref_member_id", user.id)
      .maybeSingle();
    setVerificationStatus(vs?.status || "draft");

    const { data: inq } = await supabase
      .from("ref_inquiries")
      .select("id, subject, message, created_at, organizer_member_id, members ( display_name )")
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false });
    setInquiries((inq as unknown as InquiryRow[]) || []);

    if (rp?.is_assignor) {
      try {
        const rosterRes = await fetch("/api/assignor/roster");
        const rosterJson = (await rosterRes.json()) as { entries?: AssignorRosterEntry[] };
        setRosterEntries(rosterJson.entries ?? []);
      } catch {
        setRosterEntries([]);
      }
    } else {
      setRosterEntries([]);
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
        additional_sports: additionalSports,
        certification_level: cert,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", user.id);
    setMsg(error ? error.message : "Profile saved.");
  }

  async function toggleAssignor(enabled: boolean) {
    setAssignorSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_assignor: enabled }),
      });
      const json = (await res.json()) as { error?: string; isAssignor?: boolean };
      if (!res.ok) {
        setMsg(json.error || "Could not update assignor mode.");
        return;
      }
      setIsAssignor(Boolean(json.isAssignor));
      setMsg(enabled ? "Assignor mode enabled. Add refs you work with below." : "Assignor mode turned off.");
      if (enabled) {
        const rosterRes = await fetch("/api/assignor/roster");
        const rosterJson = (await rosterRes.json()) as { entries?: AssignorRosterEntry[] };
        setRosterEntries(rosterJson.entries ?? []);
      } else {
        setRosterEntries([]);
      }
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setAssignorSaving(false);
    }
  }

  async function addRosterRef(payload: {
    display_name: string;
    primary_sport: string;
    additional_sports: string[];
    certification_level: string;
    rate_per_game: number | null;
    availability: { start_at: string; end_at: string }[];
    notes: string;
  }) {
    setRosterSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignor/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: payload.display_name,
          primary_sport: payload.primary_sport,
          additional_sports: payload.additional_sports,
          certification_level: payload.certification_level,
          rate_per_game: payload.rate_per_game,
          availability: payload.availability,
          notes: payload.notes || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; entry?: AssignorRosterEntry };
      if (!res.ok) {
        setMsg(json.error || "Could not add ref.");
        return;
      }
      if (json.entry) setRosterEntries((prev) => [json.entry!, ...prev]);
      setMsg("Ref saved to your assignor roster.");
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setRosterSaving(false);
    }
  }

  async function removeRosterRef(id: string) {
    const res = await fetch(`/api/assignor/roster?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setRosterEntries((prev) => prev.filter((e) => e.id !== id));
      setMsg("Removed from roster.");
    }
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

  async function uploadVerificationFile(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "government_id_path" | "certification_document_path"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const prefix = field === "government_id_path" ? "gov_id" : "cert";
    const path = `${user.id}/${prefix}_${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("verification_documents")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    const update: Record<string, string> = { [field]: path, updated_at: new Date().toISOString() };
    if (field === "government_id_path") {
      update.verification_doc_path = path;
    }
    await supabase.from("ref_profiles").update(update).eq("member_id", user.id);
    if (field === "government_id_path") setGovIdPath(path);
    else setCertDocPath(path);
    setMsg(field === "government_id_path" ? "Government ID uploaded." : "Certification document uploaded.");
  }

  async function submitVerificationPackage() {
    setMsg(null);
    setSubmittingVerification(true);
    try {
      const res = await fetch("/api/verification/submit", { method: "POST" });
      const j = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setMsg(j.error || "Could not submit verification.");
        return;
      }
      setVerificationStatus(j.status || "submitted");
      setMsg("Verification package submitted for review.");
      await load();
    } catch {
      setMsg("Network error — could not submit verification.");
    } finally {
      setSubmittingVerification(false);
    }
  }

  async function saveExternalVerification(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!externalCompany.trim()) {
      setMsg("Enter the company or organization that verified you first.");
      return;
    }
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/external_${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("verification_documents")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setMsg(upErr.message);
      return;
    }
    const { error: profErr } = await supabase
      .from("ref_profiles")
      .update({
        verification_method: "external",
        external_verifier_name: externalCompany.trim(),
        external_verification_proof_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", user.id);
    if (profErr) {
      setMsg(profErr.message);
      return;
    }
    await supabase
      .from("screening_checks")
      .update({
        status: "clear",
        summary: `External verification on file (${externalCompany.trim()})`,
        updated_at: new Date().toISOString(),
      })
      .eq("ref_member_id", user.id);
    setExternalProofPath(path);
    setVerificationMethod("external");
    setMsg("External verification saved. You can request events and accept offers.");
    await load();
  }

  const isVerified = refOfferEligible({
    screeningStatus: screening?.status,
    verificationMethod,
    externalProofPath,
    verificationSubmissionStatus: verificationStatus,
    profile: {
      government_id_path: govIdPath,
      verification_doc_path: govIdPath,
      certification_document_path: certDocPath,
      bio,
      primary_sport: sport,
      certification_level: cert,
    },
  });

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="rounded-xl border border-[var(--red)]/20 bg-gradient-to-r from-[var(--red)]/5 to-white p-6">
        <h1 className="font-display text-3xl font-bold text-[var(--red)]">Referee dashboard</h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Set your profile, verify your credentials, browse events, and accept paid assignments.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm text-[var(--navy)] shadow-sm">{msg}</p>}

      <RefEventCalendar />

      {inquiries.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-[var(--blue)]">Organizer messages</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Event organizers reach you through {BRAND_NAME} — their messages appear here, not your personal email.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {inquiries.map((inq) => {
              const org = Array.isArray(inq.members) ? inq.members[0] : inq.members;
              return (
                <li key={inq.id} className="rounded border border-[var(--border)] px-3 py-3">
                  <p className="font-medium text-[var(--navy)]">{inq.subject}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    From {org?.display_name ?? "Event organizer"} · {new Date(inq.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[var(--slate)]">{inq.message}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AssignorRosterPanel
        isAssignor={isAssignor}
        assignorSaving={assignorSaving}
        entries={rosterEntries}
        rosterSaving={rosterSaving}
        onToggleAssignor={(enabled) => void toggleAssignor(enabled)}
        onAddRef={addRosterRef}
        onRemoveRef={(id) => void removeRosterRef(id)}
      />

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Already verified elsewhere?</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          If another company already background-checked or certified you, enter their name and upload a
          receipt or screenshot. That lets you request events and accept offers without running Checkr again.
        </p>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          Verifying company / organization
          <input
            className="rounded border border-[var(--border)] px-2 py-1"
            value={externalCompany}
            onChange={(e) => setExternalCompany(e.target.value)}
            placeholder="e.g. NFHS, local assignor, prior platform"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Receipt or screenshot (JPG, PNG, PDF)
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="text-sm"
            onChange={(e) => void saveExternalVerification(e)}
          />
        </label>
        {externalProofPath && (
          <p className="mt-2 text-sm text-green-700">
            External proof on file{verificationMethod === "external" ? " — verified via third party" : ""}.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Background screening</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {BRAND_NAME} uses a third-party provider (Checkr) to run criminal and other screenings permitted
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
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Verification package</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Upload both documents below, complete your profile, then submit for review. Files stay in private storage.
        </p>
        <p className="mt-3 text-sm">
          Status:{" "}
          <span className="font-semibold capitalize text-[var(--blue)]">{verificationStatus.replace(/_/g, " ")}</span>
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <VerificationUploadField
            title="Government ID"
            description="Driver license, passport, or state ID — required for all referees."
            uploaded={Boolean(govIdPath)}
            uploadedLabel="✓ Government ID on file"
            onFile={(e) => void uploadVerificationFile(e, "government_id_path")}
          />
          <VerificationUploadField
            title="Certification / license document"
            description="NFHS, state association, or league certification — required to verify your credentials."
            uploaded={Boolean(certDocPath)}
            uploadedLabel="✓ Certification document on file"
            onFile={(e) => void uploadVerificationFile(e, "certification_document_path")}
          />
        </div>
        <button
          type="button"
          disabled={submittingVerification || verificationStatus === "submitted" || verificationStatus === "under_review"}
          onClick={() => void submitVerificationPackage()}
          className="mt-6 rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submittingVerification
            ? "Submitting…"
            : verificationStatus === "submitted" || verificationStatus === "under_review"
              ? "Submitted — awaiting review"
              : "Submit verification package"}
        </button>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-bold text-[var(--navy)]">Profile & rate</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SportsFields
            primarySport={sport}
            additionalSports={additionalSports}
            onPrimaryChange={setSport}
            onAdditionalChange={setAdditionalSports}
          />
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
                    {ev?.sport} · {ev?.starts_at && new Date(ev.starts_at).toLocaleString()}
                    {ev ? ` · ${formatEventLocation(ev.city, ev.state, ev.zip_code)}` : ""}
                  </p>
                  <p className="text-sm">
                    Pay offered:{" "}
                    {o.offered_pay != null ? `$${Number(o.offered_pay).toFixed(2)}` : "—"} · Status:{" "}
                    <strong>{o.status}</strong>
                  </p>
                </div>
                {o.status === "pending" && isVerified && (
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
                {o.status === "pending" && !isVerified && (
                  <p className="text-xs text-amber-700">
                    Upload ID + certification, complete your profile, then submit verification — or complete
                    screening — before accepting.
                  </p>
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
