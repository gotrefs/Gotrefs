"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { RefVerificationResubmitFlow } from "@/components/RefVerificationResubmitFlow";
import { RefEventCalendar } from "@/components/RefEventCalendar";
import { RefereeIdCard, type EditableRefCardField } from "@/components/RefereeIdCard";
import { SportsFields } from "@/components/SportsFields";
import { VerificationUploadField } from "@/components/VerificationUploadField";
import { BRAND_NAME } from "@/lib/brand";
import { refOfferEligible, refProfilePackageComplete, refVerificationApproved, refVerificationPendingReview, refVerificationRejected } from "@/lib/ref-eligibility";
import { normalizeFixRequiredSteps, REF_VERIFICATION_STEPS, type RefVerificationStepKey } from "@/lib/ref-verification-steps";

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
type VerificationStep = "id" | "certification" | "external" | "submit";

function refVerificationNeedsFix(status: string, fixSteps: RefVerificationStepKey[]): boolean {
  return (status === "rejected" || status === "under_review") && fixSteps.length > 0;
}

function isMissingRateRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["rate_type", "rate_min", "rate_max"].some((column) => message.includes(column));
}

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
  const gamesRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef<HTMLElement | null>(null);
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
  const [rateType, setRateType] = useState<"exact" | "range">("exact");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [cert, setCert] = useState("Youth / Recreational");
  const [bio, setBio] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<"checkr" | "external">("checkr");
  const [externalCompany, setExternalCompany] = useState("");
  const [externalProofPath, setExternalProofPath] = useState<string | null>(null);
  const [govIdPath, setGovIdPath] = useState<string | null>(null);
  const [certDocPath, setCertDocPath] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>("draft");
  const [verificationAdminNotes, setVerificationAdminNotes] = useState<string | null>(null);
  const [verificationNotesUpdatedAt, setVerificationNotesUpdatedAt] = useState<string | null>(null);
  const [verificationReviewedAt, setVerificationReviewedAt] = useState<string | null>(null);
  const [verificationFixRequiredSteps, setVerificationFixRequiredSteps] = useState<RefVerificationStepKey[]>([]);
  const [showResubmitFlow, setShowResubmitFlow] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: "approved" | "fix_required" | "rejected";
    message: string;
  } | null>(null);
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
    setMemberId(user.id);
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

    const profileResult = await supabase
      .from("ref_profiles")
      .select(
        "rate_per_game, rate_type, rate_min, rate_max, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
      )
      .eq("member_id", user.id)
      .maybeSingle();
    let rp = profileResult.data;
    const rpErr = profileResult.error;
    if (rpErr?.message.includes("rate_type")) {
      const fallback = await supabase
        .from("ref_profiles")
        .select(
          "rate_per_game, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
        )
        .eq("member_id", user.id)
        .maybeSingle();
      rp = fallback.data as typeof rp;
    }
    if (rp) {
      setRate(rp.rate_per_game != null ? String(rp.rate_per_game) : "");
      setRateType(rp.rate_type === "range" ? "range" : "exact");
      setRateMin(rp.rate_min != null ? String(rp.rate_min) : "");
      setRateMax(rp.rate_max != null ? String(rp.rate_max) : "");
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

    const { data: vs, error: vsError } = await supabase
      .from("ref_verification_submissions")
      .select("status, admin_notes, updated_at, reviewed_at, fix_required_steps, resubmitted_at")
      .eq("ref_member_id", user.id)
      .maybeSingle();

    let submission: {
      status?: string | null;
      admin_notes?: string | null;
      updated_at?: string | null;
      reviewed_at?: string | null;
      fix_required_steps?: unknown;
      resubmitted_at?: string | null;
    } | null = vs;
    if (vsError?.message.includes("fix_required_steps")) {
      const fallback = await supabase
        .from("ref_verification_submissions")
        .select("status, admin_notes, updated_at, reviewed_at")
        .eq("ref_member_id", user.id)
        .maybeSingle();
      submission = fallback.data;
    }

    setVerificationStatus(submission?.status || "draft");
    setVerificationAdminNotes(submission?.admin_notes?.trim() || null);
    setVerificationNotesUpdatedAt(submission?.updated_at || null);
    setVerificationReviewedAt(submission?.reviewed_at || null);
    setVerificationFixRequiredSteps(normalizeFixRequiredSteps(submission?.fix_required_steps));

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
  }, [
    supabase,
    setAdditionalSports,
    setBio,
    setCardMeta,
    setCert,
    setCertDocPath,
    setDisplayName,
    setExternalCompany,
    setExternalProofPath,
    setGovIdPath,
    setInquiries,
    setIsAssignor,
    setLoading,
    setOffers,
    setRate,
    setRateMax,
    setRateMin,
    setRateType,
    setRosterEntries,
    setScreening,
    setSlots,
    setSport,
    setVerificationMethod,
    setVerificationStatus,
    setVerificationAdminNotes,
    setVerificationNotesUpdatedAt,
    setVerificationReviewedAt,
    setVerificationFixRequiredSteps,
    setMemberId,
  ]);

  useEffect(() => {
    if (loading || !memberId) return;

    const fixFingerprint = verificationFixRequiredSteps.join(",");
    const fingerprint = `${verificationStatus}:${verificationReviewedAt ?? verificationNotesUpdatedAt ?? ""}:${verificationAdminNotes ?? ""}:${fixFingerprint}`;
    const storageKey = `gotrefs-ref-verification-notice-seen:${memberId}`;
    if (window.localStorage.getItem(storageKey) === fingerprint) return;

    if (refVerificationApproved(verificationStatus)) {
      setVerificationNotice({
        type: "approved",
        message:
          verificationAdminNotes ||
          "Application Approved — you can now request to work games and browse the calendar below.",
      });
      return;
    }

    if (refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps)) {
      setVerificationNotice({
        type: "fix_required",
        message:
          verificationAdminNotes ||
          "GotREFS needs you to update part of your application. Complete the steps we flagged and resubmit.",
      });
      return;
    }

    if (refVerificationRejected(verificationStatus)) {
      setVerificationNotice({
        type: "rejected",
        message:
          verificationAdminNotes ||
          "Your verification was not approved. Please contact GotREFS support if you have questions.",
      });
    }
  }, [
    loading,
    memberId,
    verificationStatus,
    verificationReviewedAt,
    verificationNotesUpdatedAt,
    verificationAdminNotes,
    verificationFixRequiredSteps,
  ]);

  function dismissVerificationNotice() {
    if (!memberId) {
      setVerificationNotice(null);
      return;
    }
    const fixFingerprint = verificationFixRequiredSteps.join(",");
    const fingerprint = `${verificationStatus}:${verificationReviewedAt ?? verificationNotesUpdatedAt ?? ""}:${verificationAdminNotes ?? ""}:${fixFingerprint}`;
    window.localStorage.setItem(`gotrefs-ref-verification-notice-seen:${memberId}`, fingerprint);

    const noticeType = verificationNotice?.type;
    setVerificationNotice(null);

    if (noticeType === "approved") {
      window.requestAnimationFrame(() => {
        gamesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (verificationFixRequiredSteps.length > 0) {
      setShowResubmitFlow(true);
    }
  }

  async function handleResubmitComplete() {
    setShowResubmitFlow(false);
    setMsg("Application successfully submitted — we'll review your updates within 1-2 business days.");
    await load();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

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
      if (panel === "offers") notificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const minNum = rateMin === "" ? null : Number(rateMin);
    const maxNum = rateMax === "" ? null : Number(rateMax);
    const update = {
      member_id: user.id,
      rate_per_game: rateType === "range" && Number.isFinite(minNum as number) ? minNum : rateNum,
      rate_type: rateType,
      rate_min: rateType === "range" && Number.isFinite(minNum as number) ? minNum : null,
      rate_max: rateType === "range" && Number.isFinite(maxNum as number) ? maxNum : null,
      primary_sport: sport,
      additional_sports: additionalSports,
      certification_level: cert,
      bio,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabase
      .from("ref_profiles")
      .upsert(update, { onConflict: "member_id" });
    if (isMissingRateRangeColumn(error)) {
      const legacyUpdate: Record<string, unknown> = { ...update };
      delete legacyUpdate.rate_type;
      delete legacyUpdate.rate_min;
      delete legacyUpdate.rate_max;
      const retry = await supabase.from("ref_profiles").upsert(legacyUpdate, { onConflict: "member_id" });
      error = retry.error;
    }
    if (error) {
      setMsg(error.message);
      return;
    }
    await load();
    guideToNextMissingStep({ bio, sport, cert });
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
    contact_email?: string | null;
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
          contact_email: payload.contact_email,
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

  function rateLabel() {
    if (rateType === "range") {
      if (rateMin.trim() && rateMax.trim()) return `${rateMin}-${rateMax}`;
      if (rateMin.trim()) return `${rateMin}+`;
    }
    return rate;
  }

  function guideToNextMissingStep(overrides: {
    govIdPath?: string | null;
    certDocPath?: string | null;
    screeningStatus?: string | null;
    verificationStatus?: string | null;
    bio?: string;
    sport?: string;
    cert?: string;
  } = {}) {
    const nextGovIdPath = overrides.govIdPath ?? govIdPath;
    const nextCertDocPath = overrides.certDocPath ?? certDocPath;
    const nextScreeningStatus = overrides.screeningStatus ?? screening?.status ?? null;
    const nextVerificationStatus = overrides.verificationStatus ?? verificationStatus;
    const nextBio = overrides.bio ?? bio;
    const nextSport = overrides.sport ?? sport;
    const nextCert = overrides.cert ?? cert;
    const nextProfileReady = Boolean(nextBio.trim() && nextSport.trim() && nextCert.trim());
    const nextBackgroundReady =
      nextScreeningStatus === "clear" || ["submitted", "under_review", "approved"].includes(nextVerificationStatus);

    if (!nextProfileReady) {
      setMsg("Profile saved. Finish your profile details next.");
      openEditor("profile");
      return;
    }
    if (!nextGovIdPath) {
      setMsg("Profile saved. Next, upload your government ID.");
      openEditor("verification", "id");
      return;
    }
    if (!nextCertDocPath) {
      setMsg("Government ID saved. Next, upload your certification.");
      openEditor("verification", "certification");
      return;
    }
    if (!nextBackgroundReady) {
      setMsg("Certification saved. Next, submit your verification package.");
      openEditor("verification", "submit");
      return;
    }

    setMsg("Success, Find Games Now!");
    setActiveEditor(null);
    window.requestAnimationFrame(() => {
      gamesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    await load();
    guideToNextMissingStep({
      govIdPath: field === "government_id_path" ? path : govIdPath,
      certDocPath: field === "certification_document_path" ? path : certDocPath,
    });
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
      await load();
      guideToNextMissingStep({ verificationStatus: j.status || "submitted" });
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
    await load();
    guideToNextMissingStep({ screeningStatus: "clear" });
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
  const canAcceptOffers = isVerified;
  const profileReady = Boolean(bio.trim() && sport.trim() && cert.trim());
  const idReady = Boolean(govIdPath);
  const certificationReady = Boolean(certDocPath);
  const verificationApproved = refVerificationApproved(verificationStatus);
  const verificationRejected = refVerificationRejected(verificationStatus);
  const verificationNeedsFix = refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps);
  const verificationPending = refVerificationPendingReview(verificationStatus) && !verificationNeedsFix;
  const verificationSubmitted = verificationPending || verificationApproved || verificationRejected;
  const showPendingReviewView = verificationPending;
  const canApplyToGames = canAcceptOffers;
  const backgroundReady = screening?.status === "clear" || verificationSubmitted;
  const pendingOffers = offers.filter((offer) => offer.status === "pending");
  const hasVerificationMailboxMessage = Boolean(verificationAdminNotes);
  const hasVerificationStatusNotice =
    verificationApproved || verificationRejected || verificationNeedsFix;
  const refNotificationCount =
    pendingOffers.length + inquiries.length + (hasVerificationMailboxMessage || hasVerificationStatusNotice ? 1 : 0);
  const missingActions: {
    label: string;
    description: string;
    field: EditableRefCardField;
    step?: VerificationStep;
  }[] = showPendingReviewView || verificationApproved
    ? []
    : ([
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
        !verificationSubmitted && {
          label: "Submit for review",
          description: "Submit your verification package or upload proof if you were verified elsewhere.",
          field: "verification" as const,
          step: "submit" as const,
        },
      ].filter(Boolean) as {
        label: string;
        description: string;
        field: EditableRefCardField;
        step?: VerificationStep;
      }[]);
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
      {verificationNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className={`w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ${
              verificationNotice.type === "approved"
                ? "border border-green-200"
                : verificationNotice.type === "fix_required"
                  ? "border border-amber-200"
                  : "border border-red-200"
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.18em] ${
                verificationNotice.type === "approved"
                  ? "text-green-700"
                  : verificationNotice.type === "fix_required"
                    ? "text-amber-700"
                    : "text-[var(--red)]"
              }`}
            >
              {verificationNotice.type === "approved"
                ? "Application Approved"
                : verificationNotice.type === "fix_required"
                  ? "Updates needed"
                  : "Verification update"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--navy)]">
              {verificationNotice.type === "approved"
                ? "You're approved to request games!"
                : verificationNotice.type === "fix_required"
                  ? "Please fix and resubmit your application"
                  : "Verification not approved"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--slate)]">{verificationNotice.message}</p>
            {verificationNotice.type === "fix_required" && verificationFixRequiredSteps.length > 0 && (
              <p className="mt-3 text-sm font-semibold text-[var(--navy)]">
                Steps to complete:{" "}
                {REF_VERIFICATION_STEPS.filter((step) => verificationFixRequiredSteps.includes(step.key))
                  .map((step) => step.number)
                  .join(", ")}
              </p>
            )}
            <button
              type="button"
              onClick={dismissVerificationNotice}
              className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black text-white ${
                verificationNotice.type === "approved"
                  ? "bg-green-600"
                  : verificationNotice.type === "fix_required"
                    ? "bg-amber-600"
                    : "bg-[var(--red)]"
              }`}
            >
              {verificationNotice.type === "approved" ? "Go to calendar" : "Got it"}
            </button>
          </div>
        </div>
      )}

      {showResubmitFlow && memberId && verificationFixRequiredSteps.length > 0 && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/55 p-4">
          <div className="mx-auto flex min-h-full max-w-2xl items-start py-6">
            <RefVerificationResubmitFlow
              memberId={memberId}
              steps={verificationFixRequiredSteps}
              adminMessage={verificationAdminNotes || "GotREFS requested updates to your application."}
              displayName={displayName}
              primarySport={sport}
              additionalSports={additionalSports}
              certificationLevel={cert}
              baseCity={cardMeta.baseCity ?? ""}
              travelRadius={cardMeta.travelRadius ?? ""}
              workRegions={cardMeta.workRegions ?? []}
              onComplete={() => void handleResubmitComplete()}
            />
          </div>
        </div>
      )}

      {!showResubmitFlow && !canAcceptOffers ? (
        <div
          ref={gamesRef}
          className="grid gap-6 rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-[var(--blue)]/10 p-5 shadow-sm lg:grid-cols-[1fr_1.15fr] lg:p-7"
        >
          <div>
            {verificationNeedsFix && (
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Fixes requested</p>
            )}
            {showPendingReviewView && (
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">
                Pending Verification (1-2 Business Days)
              </p>
            )}
            {verificationRejected && !verificationNeedsFix && (
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--red)]">Not approved</p>
            )}
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-[var(--navy)]">
              Browse games now. Get Paid Quickly.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
              {verificationNeedsFix
                ? "GotREFS flagged part of your application. Complete only the steps we listed, then resubmit for review. You can still browse open games while you wait."
                : verificationRejected
                  ? "You can still browse open games, but you cannot request to work until verification is resolved. Check your notification inbox for details from GotREFS."
                  : "Once approved, you will be able to request to work at any games. Approvals take 1-2 business days."}
            </p>
            {verificationNeedsFix && !showResubmitFlow && (
              <button
                type="button"
                onClick={() => setShowResubmitFlow(true)}
                className="mt-4 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-black text-white"
              >
                Fix & resubmit application
              </button>
            )}
          </div>
          <RefEventCalendar
            embedded
            canApplyToEvents={canApplyToGames}
            applicationPending={showPendingReviewView}
            applicationRejected={verificationRejected}
            onRequireProfile={() => {
              if (showPendingReviewView) return;
              const next = missingActions[0];
              if (next) openEditor(next.field, next.step);
            }}
          />
        </div>
      ) : !showResubmitFlow ? (
        <div className="grid gap-6 rounded-[2rem] border border-green-200 bg-gradient-to-br from-green-50 via-white to-[var(--blue)]/10 p-5 shadow-sm lg:grid-cols-[1fr_0.9fr] lg:p-7">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Approved</p>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-[var(--navy)]">
              Browse games now. Get Paid Quickly.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
              Your verification is approved. Request to work open games, accept organizer invites, and manage your
              schedule.
            </p>
          </div>
          <RefereeIdCard
            fullName={displayName}
            gotrefsId={cardMeta.gotrefsId}
            primarySport={sport}
            additionalSports={additionalSports}
            certificationLevel={cert}
            certifiedBy={cardMeta.certifiedBy}
            rate={rateLabel()}
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
      ) : null}

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm text-[var(--navy)] shadow-sm">{msg}</p>}

      {canAcceptOffers && !showResubmitFlow && (
        <section ref={gamesRef}>
          <RefEventCalendar canApplyToEvents={canApplyToGames} />
        </section>
      )}

      <section ref={notificationsRef} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-black text-[var(--navy)]">Notification inbox</h2>
              {refNotificationCount > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--red)] px-2 text-xs font-black text-white">
                  {refNotificationCount}!
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Organizer invites, verification updates, and messages show up here.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {verificationApproved && (
            <article className="rounded-2xl border border-green-200 bg-green-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-green-700">Verification approved</p>
              <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                {verificationAdminNotes ||
                  "Your verification has been approved! You can now request to work games on GotREFS."}
              </p>
              {verificationReviewedAt && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  From GotREFS · {new Date(verificationReviewedAt).toLocaleString()}
                </p>
              )}
            </article>
          )}
          {verificationNeedsFix && (
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Fixes requested</p>
              <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                {verificationAdminNotes ||
                  "GotREFS needs updates to your application before we can approve you."}
              </p>
              {verificationReviewedAt && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  From GotREFS · {new Date(verificationReviewedAt).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowResubmitFlow(true)}
                className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white"
              >
                Fix & resubmit
              </button>
            </article>
          )}
          {verificationRejected && !verificationNeedsFix && (
            <article className="rounded-2xl border border-red-200 bg-red-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">Verification not approved</p>
              <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                {verificationAdminNotes ||
                  "Your verification was not approved. Please contact GotREFS support if you have questions."}
              </p>
              {verificationReviewedAt && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  From GotREFS · {new Date(verificationReviewedAt).toLocaleString()}
                </p>
              )}
            </article>
          )}
          {hasVerificationMailboxMessage &&
            !verificationApproved &&
            !verificationRejected &&
            !verificationNeedsFix && (
            <article className="rounded-2xl border border-blue-100 bg-blue-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--blue)]">Verification update</p>
              <p className="mt-1 text-sm font-bold text-[var(--navy)]">{verificationAdminNotes}</p>
              {verificationNotesUpdatedAt && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  From GotREFS · {new Date(verificationNotesUpdatedAt).toLocaleString()}
                </p>
              )}
            </article>
          )}
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
              No messages yet. Organizer invites and verification updates will show up here.
            </div>
          )}
        </div>
      </section>

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
                  Rate per game
                  <div className="rounded border border-[var(--border)] p-2">
                    <div className="mb-2 flex gap-2 text-xs font-bold">
                      {(["exact", "range"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRateType(type)}
                          className={`rounded-full px-3 py-1 capitalize ${
                            rateType === type ? "bg-[var(--navy)] text-white" : "bg-slate-100 text-[var(--muted)]"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    {rateType === "exact" ? (
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded border border-[var(--border)] px-2 py-1"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="e.g. 45"
                      />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          className="rounded border border-[var(--border)] px-2 py-1"
                          value={rateMin}
                          onChange={(e) => setRateMin(e.target.value)}
                          placeholder="Min"
                        />
                        <input
                          type="number"
                          min={0}
                          className="rounded border border-[var(--border)] px-2 py-1"
                          value={rateMax}
                          onChange={(e) => setRateMax(e.target.value)}
                          placeholder="Max"
                        />
                      </div>
                    )}
                  </div>
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
                  the verification package. You can also upload proof if you were verified elsewhere.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["id", "Government ID"],
                  ["certification", "Certification"],
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
                      ? "Submitting..."
                      : verificationStatus === "submitted" || verificationStatus === "under_review"
                        ? "Submitted - awaiting review"
                        : "Submit verification package"}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={verificationStep === "id"}
                  onClick={() => {
                    const steps: VerificationStep[] = ["id", "certification", "external", "submit"];
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
                    const steps: VerificationStep[] = ["id", "certification", "external", "submit"];
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

    </div>
  );
}
