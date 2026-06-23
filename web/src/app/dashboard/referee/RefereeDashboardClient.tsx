"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { RefEventCalendar } from "@/components/RefEventCalendar";
import { RefereeIdCard, type EditableRefCardField } from "@/components/RefereeIdCard";
import { SportsFields } from "@/components/SportsFields";
import { VerificationUploadField } from "@/components/VerificationUploadField";
import { formatEventLocation } from "@/data/sports";
import { BRAND_NAME } from "@/lib/brand";
import { refOfferEligible, refProfilePackageComplete } from "@/lib/ref-eligibility";

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
  message: string | null;
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

type AvailabilitySlot = { id: string; start_at: string; end_at: string };
type VerificationStep = "id" | "certification" | "screening" | "external" | "submit";

function formatAvailabilityForCard(slots: AvailabilitySlot[]) {
  if (slots.length === 0) return "Add availability";
  const next = [...slots].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )[0];
  const formatRangePoint = (value: string) => {
    const date = new Date(value);
    const day = date.toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
    const time = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${day} ${time}`;
  };
  const extra = slots.length > 1 ? ` +${slots.length - 1} more` : "";
  return `${formatRangePoint(next.start_at)} - ${formatRangePoint(next.end_at)}${extra}`;
}

export default function RefereeDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const editorRef = useRef<HTMLElement | null>(null);
  const notificationsRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef<HTMLElement | null>(null);
  const offersRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEditor, setActiveEditor] = useState<EditableRefCardField | "assignor" | null>(null);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>("id");
  const [displayName, setDisplayName] = useState("");
  const [cardMeta, setCardMeta] = useState<{
    gotrefsId?: string;
    certifiedBy?: string;
    baseCity?: string;
    workRegions?: string[];
    travelRadius?: string;
    verificationSkipped?: boolean;
  }>({});
  const [screening, setScreening] = useState<Screening | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
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
    const meta = user.user_metadata ?? {};
    setDisplayName(
      String(meta.full_name ?? "").trim() ||
        `${String(meta.first_name ?? "").trim()} ${String(meta.last_name ?? "").trim()}`.trim() ||
        user.email?.split("@")[0] ||
        "Referee"
    );
    setCardMeta({
      gotrefsId: typeof meta.gotrefs_id === "string" ? meta.gotrefs_id : undefined,
      certifiedBy: typeof meta.certified_by === "string" ? meta.certified_by : undefined,
      baseCity: typeof meta.base_city === "string" ? meta.base_city : undefined,
      workRegions: Array.isArray(meta.work_regions)
        ? meta.work_regions.filter((region): region is string => typeof region === "string")
        : undefined,
      travelRadius:
        typeof meta.travel_radius_miles === "number" || typeof meta.travel_radius_miles === "string"
          ? String(meta.travel_radius_miles)
          : undefined,
      verificationSkipped: meta.verification_skipped === true,
    });

    const { data: sc } = await supabase
      .from("screening_checks")
      .select("status, summary")
      .eq("ref_member_id", user.id)
      .maybeSingle();
    setScreening(sc);

    const { data: o } = await supabase
      .from("assignment_offers")
      .select(
        "id, status, offered_pay, message, scheduled_events ( title, sport, starts_at, zip_code, city, state )"
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
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (!activeEditor) return;
    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeEditor]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel || loading) return;
    window.requestAnimationFrame(() => {
      if (panel === "offers") offersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "messages") messagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "notifications") notificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, searchParams]);

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

  async function saveCardMetadata() {
    setMsg(null);
    const { error } = await supabase.auth.updateUser({
      data: {
        certified_by: cardMeta.certifiedBy || null,
        base_city: cardMeta.baseCity || null,
        work_regions: cardMeta.workRegions ?? [],
        travel_radius_miles: cardMeta.travelRadius ? Number(cardMeta.travelRadius) : null,
      },
    });
    setMsg(error ? error.message : "Card details saved.");
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
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setMsg("End time must be after start time.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const startIso = new Date(startAt).toISOString();
    const endIso = new Date(endAt).toISOString();
    const { data, error } = await supabase
      .from("ref_availability")
      .insert({
        ref_member_id: user.id,
        start_at: startIso,
        end_at: endIso,
      })
      .select("id, start_at, end_at")
      .single();
    if (error) {
      setMsg(error.message);
      return;
    }
    const nextSlot = (data as AvailabilitySlot | null) ?? {
      id: crypto.randomUUID(),
      start_at: startIso,
      end_at: endIso,
    };
    setSlots((prev) =>
      [...prev, nextSlot].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      )
    );
    setStartAt("");
    setEndAt("");
    setMsg("Availability added. Your ref ID card is updated.");
  }

  async function removeSlot(id: string) {
    const previous = slots;
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
    const { error } = await supabase.from("ref_availability").delete().eq("id", id);
    if (error) {
      setSlots(previous);
      setMsg(error.message);
      return;
    }
    setMsg("Availability removed. Your ref ID card is updated.");
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
  const profileComplete = refProfilePackageComplete({
    government_id_path: govIdPath,
    verification_doc_path: govIdPath,
    certification_document_path: certDocPath,
    bio,
    primary_sport: sport,
    certification_level: cert,
  });
  const verificationSubmitted = ["submitted", "under_review", "approved"].includes(verificationStatus);
  const canAcceptOffers = isVerified;
  const profileReady = Boolean(bio.trim() && sport.trim() && cert.trim());
  const idReady = Boolean(govIdPath);
  const certificationReady = Boolean(certDocPath);
  const backgroundReady = screening?.status === "clear" || verificationSubmitted;
  const pendingOffers = offers.filter((offer) => offer.status === "pending");
  const refNotificationCount = pendingOffers.length + inquiries.length;
  const missingActions: {
    label: string;
    description: string;
    field: EditableRefCardField;
    step?: VerificationStep;
  }[] = [
    !profileReady && {
      label: "Profile",
      description: "Add sport, certification level, rate, and bio.",
      field: "profile" as const,
    },
    !idReady && {
      label: "Government ID",
      description: "Upload a driver license, passport, or state ID.",
      field: "verification" as const,
      step: "id" as const,
    },
    !certificationReady && {
      label: "Certification",
      description: "Upload NFHS, state association, or league credentials.",
      field: "verification" as const,
      step: "certification" as const,
    },
    !backgroundReady && {
      label: "Background / review",
      description: "Start screening, add outside proof, or submit the package.",
      field: "verification" as const,
      step: "screening" as const,
    },
  ].filter(Boolean) as {
    label: string;
    description: string;
    field: EditableRefCardField;
    step?: VerificationStep;
  }[];
  const availabilitySummary = formatAvailabilityForCard(slots);
  const avatarLabel = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "REF";

  function openEditor(field: EditableRefCardField | "assignor", step?: VerificationStep) {
    if (step) setVerificationStep(step);
    setActiveEditor(field);
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-6 rounded-[2rem] border border-[var(--red)]/20 bg-gradient-to-br from-[var(--red)]/10 via-white to-[var(--blue)]/10 p-5 shadow-sm lg:grid-cols-[1fr_0.9fr] lg:p-7">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--red)]">
            {canAcceptOffers ? "Verified profile" : "Pending verification"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-[var(--navy)]">
            Browse games now. Finish badges to accept.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
            Your profile is live as a pending ref, so you can see available games in your area immediately.
            Complete the ID, certification, and background badges when you are ready to accept paid assignments.
          </p>
          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--red)]">
              Missing info
            </p>
            {missingActions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {missingActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => openEditor(action.field, action.step)}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] shadow-sm transition hover:border-[var(--red)] hover:bg-[var(--red)] hover:text-white"
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                All profile badges are complete.
              </p>
            )}
          </div>
        </div>
        <RefereeIdCard
          fullName={displayName}
          gotrefsId={cardMeta.gotrefsId}
          primarySport={sport}
          additionalSports={additionalSports}
          certificationLevel={cert}
          certifiedBy={cardMeta.certifiedBy}
          rate={rate}
          avatarLabel={avatarLabel}
          baseCity={cardMeta.baseCity}
          workRegions={cardMeta.workRegions}
          travelRadius={cardMeta.travelRadius}
          availabilitySummary={availabilitySummary}
          govIdUploaded={Boolean(govIdPath)}
          certUploaded={Boolean(certDocPath)}
          backgroundStatus={screening?.status}
          verificationStatus={verificationStatus}
          verificationSkipped={cardMeta.verificationSkipped}
          profileComplete={profileComplete}
          onEditField={(field) => openEditor(field)}
        />
      </div>

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm text-[var(--navy)] shadow-sm">{msg}</p>}

      <section ref={notificationsRef} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-black text-[var(--navy)]">Notification inbox</h2>
              {refNotificationCount > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--red)] px-2 text-xs font-black text-white">
                  ! {refNotificationCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Organizer invites and messages show up here the moment they reach out.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pendingOffers.slice(0, 4).map((offer) => {
            const ev = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
            return (
              <article key={offer.id} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">New organizer invite</p>
                <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                  {ev?.title ?? "An organizer"} invited you to work a game.
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {ev?.sport} {ev?.starts_at ? `· ${new Date(ev.starts_at).toLocaleString()}` : ""}
                </p>
              </article>
            );
          })}
          {inquiries.slice(0, 4).map((inq) => {
            const org = Array.isArray(inq.members) ? inq.members[0] : inq.members;
            return (
              <article key={inq.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Organizer message</p>
                <p className="mt-1 text-sm font-bold text-[var(--navy)]">{inq.subject}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  From {org?.display_name ?? "Event organizer"} · {new Date(inq.created_at).toLocaleString()}
                </p>
              </article>
            );
          })}
          {refNotificationCount === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)] md:col-span-2">
              No organizer invites yet. When an organizer messages or invites you, you&apos;ll see it here.
            </div>
          )}
        </div>
      </section>

      <RefEventCalendar canApplyToEvents={profileReady} onRequireProfile={() => openEditor("profile")} />

      {activeEditor && (
        <section ref={editorRef} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Edit card</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[var(--navy)]">
                {activeEditor === "availability"
                  ? "Availability"
                  : activeEditor === "verification"
                    ? "How to become verified"
                    : activeEditor === "location"
                      ? "Location & travel range"
                      : "Profile details"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveEditor(null)}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-medium"
            >
              Close
            </button>
          </div>

          {(activeEditor === "profile" ||
            activeEditor === "photo" ||
            activeEditor === "sports" ||
            activeEditor === "certification" ||
            activeEditor === "rate") && (
            <div className="mt-5">
              {activeEditor === "photo" && (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Photo upload is preview-only during signup right now. Permanent headshots need a small Supabase
                  storage field next.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <SportsFields
                  primarySport={sport}
                  additionalSports={additionalSports}
                  onPrimaryChange={setSport}
                  onAdditionalChange={setAdditionalSports}
                />
                <label className="flex flex-col gap-1 text-sm">
                  Certified by
                  <input
                    className="rounded border border-[var(--border)] px-2 py-1"
                    value={cardMeta.certifiedBy ?? ""}
                    placeholder="NFHS, AIA, USSF, local association"
                    onChange={(e) => setCardMeta((prev) => ({ ...prev, certifiedBy: e.target.value }))}
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
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  className="rounded-lg bg-[var(--orange)] px-4 py-2 text-sm font-medium text-white"
                >
                  Save profile
                </button>
                <button
                  type="button"
                  onClick={() => void saveCardMetadata()}
                  className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white"
                >
                  Save card details
                </button>
              </div>
            </div>
          )}

          {activeEditor === "location" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Base city
                <input
                  className="rounded border border-[var(--border)] px-2 py-1"
                  value={cardMeta.baseCity ?? ""}
                  placeholder="Phoenix, AZ"
                  onChange={(e) => setCardMeta((prev) => ({ ...prev, baseCity: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Travel radius (miles)
                <input
                  type="number"
                  min={0}
                  className="rounded border border-[var(--border)] px-2 py-1"
                  value={cardMeta.travelRadius ?? ""}
                  onChange={(e) => setCardMeta((prev) => ({ ...prev, travelRadius: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Regions willing to work
                <input
                  className="rounded border border-[var(--border)] px-2 py-1"
                  value={(cardMeta.workRegions ?? []).join(", ")}
                  placeholder="County-wide, Statewide, Tournament travel"
                  onChange={(e) =>
                    setCardMeta((prev) => ({
                      ...prev,
                      workRegions: e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => void saveCardMetadata()}
                className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white sm:w-fit"
              >
                Save location
              </button>
            </div>
          )}

          {activeEditor === "availability" && (
            <div className="mt-5">
              <div className="flex flex-wrap items-end gap-3">
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
            </div>
          )}

          {activeEditor === "verification" && (
            <div className="mt-5 grid gap-5">
              <div className="rounded-xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 p-4 text-sm text-[var(--slate)]">
                <p className="font-bold text-[var(--navy)]">How a pending ref becomes verified</p>
                <p className="mt-2">
                  Upload a government ID, upload a certification/license document, complete your profile, then submit
                  the verification package. You can also start Checkr screening or upload proof if you were verified
                  elsewhere.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["id", "Government ID"],
                  ["certification", "Certification"],
                  ["screening", "Background"],
                  ["external", "Verified elsewhere"],
                  ["submit", "Submit"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVerificationStep(key as VerificationStep)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      verificationStep === key
                        ? "bg-[var(--red)] text-white"
                        : "border border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {verificationStep === "id" && (
                <VerificationUploadField
                  title="Government ID"
                  description="Driver license, passport, or state ID — required for all referees."
                  uploaded={Boolean(govIdPath)}
                  uploadedLabel="✓ Government ID on file"
                  onFile={(e) => void uploadVerificationFile(e, "government_id_path")}
                />
              )}

              {verificationStep === "certification" && (
                <VerificationUploadField
                  title="Certification / license document"
                  description="NFHS, state association, or league certification — required to verify your credentials."
                  uploaded={Boolean(certDocPath)}
                  uploadedLabel="✓ Certification document on file"
                  onFile={(e) => void uploadVerificationFile(e, "certification_document_path")}
                />
              )}

              {verificationStep === "screening" && (
                <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
                  <p className="font-display text-lg font-bold text-[var(--navy)]">Background screening</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Start or refresh the background screening connected to your referee profile.
                  </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Current status: <strong>{screening?.status || "unknown"}</strong>
                </p>
                <button
                  type="button"
                  disabled={screeningLoading}
                  onClick={() => void startScreening()}
                  className="mt-3 rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {screeningLoading ? "Updating…" : "Start / refresh screening"}
                </button>
              </div>
              )}

              {verificationStep === "external" && (
                <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
                  <p className="font-display text-lg font-bold text-[var(--navy)]">Already verified elsewhere?</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Upload a receipt or screenshot from another company/association.
                </p>
                <label className="mt-3 flex flex-col gap-1 text-sm">
                  Verifying company / organization
                  <input
                    className="rounded border border-[var(--border)] px-2 py-1"
                    value={externalCompany}
                    onChange={(e) => setExternalCompany(e.target.value)}
                    placeholder="e.g. NFHS, local assignor, prior platform"
                  />
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="mt-3 text-sm"
                  onChange={(e) => void saveExternalVerification(e)}
                />
              </div>
              )}

              {verificationStep === "submit" && (
                <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
                  <p className="font-display text-lg font-bold text-[var(--navy)]">Submit verification package</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Submit after your government ID, certification, and profile information are complete.
                  </p>
                <p className="text-sm">
                  Verification package status:{" "}
                  <span className="font-semibold capitalize text-[var(--blue)]">
                    {verificationStatus.replace(/_/g, " ")}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={
                    submittingVerification ||
                    verificationStatus === "submitted" ||
                    verificationStatus === "under_review"
                  }
                  onClick={() => void submitVerificationPackage()}
                  className="mt-3 rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submittingVerification
                    ? "Submitting…"
                    : verificationStatus === "submitted" || verificationStatus === "under_review"
                      ? "Submitted — awaiting review"
                      : "Submit verification package"}
                </button>
              </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={verificationStep === "id"}
                  onClick={() => {
                    const steps: VerificationStep[] = ["id", "certification", "screening", "external", "submit"];
                    const index = steps.indexOf(verificationStep);
                    setVerificationStep(steps[Math.max(0, index - 1)]);
                  }}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={verificationStep === "submit"}
                  onClick={() => {
                    const steps: VerificationStep[] = ["id", "certification", "screening", "external", "submit"];
                    const index = steps.indexOf(verificationStep);
                    setVerificationStep(steps[Math.min(steps.length - 1, index + 1)]);
                  }}
                  className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {activeEditor === "assignor" && (
            <div className="mt-5">
              <AssignorRosterPanel
                isAssignor={isAssignor}
                assignorSaving={assignorSaving}
                entries={rosterEntries}
                rosterSaving={rosterSaving}
                onToggleAssignor={(enabled) => void toggleAssignor(enabled)}
                onAddRef={addRosterRef}
                onRemoveRef={(id) => void removeRosterRef(id)}
              />
            </div>
          )}
        </section>
      )}

      {inquiries.length > 0 && (
        <section ref={messagesRef} className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
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

      <section ref={offersRef} className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
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
                  {o.message && (
                    <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--grey-light)]/40 px-3 py-2 text-sm text-[var(--slate)]">
                      {o.message}
                    </p>
                  )}
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
