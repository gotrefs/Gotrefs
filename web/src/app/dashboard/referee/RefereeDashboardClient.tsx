"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { RefVerificationResubmitFlow } from "@/components/RefVerificationResubmitFlow";
import { RefMarketplaceHub } from "@/components/marketplace/RefMarketplaceHub";
import type { RefWorkApplication, RefWorkBooking } from "@/components/marketplace/RefMyWorkPanel";
import { PendingOfferQueueModal } from "@/components/referee/PendingOfferQueueModal";
import { RefereeIdCard, type EditableRefCardField } from "@/components/RefereeIdCard";
import { RefReviewsButton } from "@/components/reviews/RefReviewsButton";
import type { PublicReview } from "@/components/reviews/ReviewsModal";
import { findStoredProfilePhotoPath, resolveProfilePhotoUrl } from "@/lib/profile-photo";
import {
  clearRefSignupDraft,
  loadRefSignupDraft,
} from "@/lib/auth/signup-draft";
import {
  submitRefVerificationForReview,
  uploadRefSignupDocuments,
} from "@/lib/auth/upload-ref-signup-docs";
import { formatCardValidThrough } from "@/lib/ref-id-card-validity";
import { publishOfficialIdCardImage } from "@/lib/ref-id-card-jpeg";
import { refOfferEligible, refProfilePackageComplete, refVerificationApproved, refVerificationPendingReview, refVerificationRejected } from "@/lib/ref-eligibility";
import {
  ALL_REF_VERIFICATION_STEP_KEYS,
  formatFixRequiredStepLabels,
  mapCardFieldToVerificationStep,
  normalizeFixRequiredSteps,
  REF_VERIFICATION_STEPS,
  resubmitNoticeTitle,
  type RefVerificationStepKey,
} from "@/lib/ref-verification-steps";

type Screening = {
  status: string;
  summary: string | null;
};

type OfferRow = {
  id: string;
  status: string;
  offered_pay: number | null;
  base_pay?: number | null;
  boost_percent?: number | null;
  message: string | null;
  organizer?: {
    displayName: string | null;
    profilePictureUrl: string | null;
  } | null;
  scheduled_events:
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
        organizer_member_id?: string;
      }
    | {
        title: string;
        sport: string;
        starts_at: string;
        zip_code: string;
        city: string | null;
        state: string | null;
        organizer_member_id?: string;
      }[]
    | null;
};

type AvailabilitySlot = { id: string; start_at: string; end_at: string };

type ProfileWizardState = {
  mode: "edit" | "resubmit";
  initialStep: RefVerificationStepKey;
  steps: RefVerificationStepKey[];
  adminMessage?: string;
};

function refVerificationNeedsFix(status: string, fixSteps: RefVerificationStepKey[]): boolean {
  return (status === "rejected" || status === "under_review") && fixSteps.length > 0;
}

function isMissingRateRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["rate_type", "rate_min", "rate_max"].some((column) => message.includes(column));
}

function formatAvailabilityForCard(slots: AvailabilitySlot[]) {
  if (slots.length === 0) return "Set dates in Explore";
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
  const router = useRouter();
  const gamesRef = useRef<HTMLDivElement | null>(null);
  const marketplaceRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileWizard, setProfileWizard] = useState<ProfileWizardState | null>(null);
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
  const [dismissOfferQueue, setDismissOfferQueue] = useState(false);
  const [applications, setApplications] = useState<RefWorkApplication[]>([]);
  const [bookings, setBookings] = useState<RefWorkBooking[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [rate, setRate] = useState("");
  const [rateType, setRateType] = useState<"exact" | "range">("exact");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [sport, setSport] = useState("Basketball");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [cert, setCert] = useState("Youth / Recreational");
  const [additionalCerts, setAdditionalCerts] = useState<string[]>([]);
  const [bio, setBio] = useState("");
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
  const [memberId, setMemberId] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: "approved" | "fix_required" | "rejected";
    title?: string;
    message: string;
    items?: string[];
  } | null>(null);
  const [applicationDecisionNotice, setApplicationDecisionNotice] = useState<{
    type: "accepted" | "declined";
    title: string;
    message: string;
  } | null>(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [isAssignor, setIsAssignor] = useState(false);
  const [assignorSaving, setAssignorSaving] = useState(false);
  const [rosterEntries, setRosterEntries] = useState<AssignorRosterEntry[]>([]);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [myRatingAverage, setMyRatingAverage] = useState<number | null>(null);
  const [myRatingCount, setMyRatingCount] = useState(0);
  const [myReviews, setMyReviews] = useState<PublicReview[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const idCardRef = useRef<HTMLDivElement | null>(null);
  const publishCardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishIdCardPhoto = useCallback(async () => {
    if (!memberId || !cardMeta.gotrefsId) return;
    try {
      await publishOfficialIdCardImage(memberId, idCardRef.current);
    } catch {
      // Non-fatal — QR falls back to the live HTML card until publish succeeds.
    }
  }, [memberId, cardMeta.gotrefsId]);

  useEffect(() => {
    if (!memberId || !cardMeta.gotrefsId || loading) return;
    if (publishCardTimer.current) clearTimeout(publishCardTimer.current);
    // Wait for photo / fonts to paint, then snapshot the exact on-screen card.
    publishCardTimer.current = setTimeout(() => {
      void publishIdCardPhoto();
    }, 900);
    return () => {
      if (publishCardTimer.current) clearTimeout(publishCardTimer.current);
    };
  }, [memberId, cardMeta.gotrefsId, avatarUrl, sport, cert, cardMeta.certifiedBy, cardMeta.baseCity, loading, publishIdCardPhoto]);

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

    const { data: memberRow } = await supabase
      .from("members")
      .select("profile_picture_url")
      .eq("id", user.id)
      .maybeSingle();
    let photoSource =
      memberRow?.profile_picture_url ||
      (typeof meta.profile_picture_url === "string" ? meta.profile_picture_url : null) ||
      (typeof meta.avatar_url === "string" ? meta.avatar_url : null);

    // Recover photos that uploaded to storage but never saved on members (e.g. bad updated_at write).
    if (!photoSource) {
      const recovered = await findStoredProfilePhotoPath(supabase, user.id);
      if (recovered) {
        photoSource = recovered;
        void supabase.from("members").update({ profile_picture_url: recovered }).eq("id", user.id);
        void supabase.auth.updateUser({ data: { profile_picture_url: recovered } });
      }
    }

    setAvatarUrl(await resolveProfilePhotoUrl(supabase, photoSource));

    // After email confirmation / failed signup upload, attach saved photo to the ID card.
    try {
      const pending =
        typeof window !== "undefined" && localStorage.getItem("gotrefs_pending_ref_docs") === "1";
      if (pending) {
        const draft = await loadRefSignupDraft();
        const draftFiles = draft?.files;
        const hasDraftFiles = Boolean(
          draftFiles?.photo || draftFiles?.govIdFront || draftFiles?.govIdBack || draftFiles?.certDoc
        );
        if (hasDraftFiles && draftFiles) {
          await uploadRefSignupDocuments(
            user.id,
            {
              profilePhoto: draftFiles.photo,
              govIdFront: draftFiles.govIdFront,
              govIdBack: draftFiles.govIdBack,
              certificationDocument: draftFiles.certDoc,
            },
            draft?.fields
              ? {
                  primarySport: draft.fields.primarySport || "Basketball",
                  additionalSports: draft.fields.secondarySport ? [draft.fields.secondarySport] : [],
                  certificationLevel: draft.fields.certificationLevel || "Youth / Recreational",
                  additionalCertificationLevels: draft.fields.additionalCertificationLevels ?? [],
                }
              : undefined
          );
          if (draftFiles.photo) {
            const { data: memberAfter } = await supabase
              .from("members")
              .select("profile_picture_url")
              .eq("id", user.id)
              .maybeSingle();
            const recoveredPath =
              memberAfter?.profile_picture_url ||
              (await findStoredProfilePhotoPath(supabase, user.id));
            const signed = await resolveProfilePhotoUrl(supabase, recoveredPath);
            if (signed) setAvatarUrl(signed);
          }
          if (draftFiles.photo && draftFiles.govIdFront && draftFiles.govIdBack && draftFiles.certDoc) {
            try {
              await submitRefVerificationForReview();
            } catch {
              // Non-fatal — user can submit from dashboard later.
            }
          }
        }
        await clearRefSignupDraft();
        localStorage.removeItem("gotrefs_pending_ref_docs");
      }
    } catch {
      // Non-fatal — user can re-upload from the ID card if needed.
    }

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

    if (typeof meta.gotrefs_id === "string" && meta.gotrefs_id.trim()) {
      void supabase
        .from("ref_profiles")
        .update({ gotrefs_id: meta.gotrefs_id.trim() })
        .eq("member_id", user.id);
    }

    const { data: sc } = await supabase
      .from("screening_checks")
      .select("status, summary")
      .eq("ref_member_id", user.id)
      .maybeSingle();
    setScreening(sc);

    let { data: o, error: offersError } = await supabase
      .from("assignment_offers")
      .select(
        "id, status, offered_pay, base_pay, boost_percent, message, scheduled_events ( title, sport, starts_at, zip_code, city, state, organizer_member_id )"
      )
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false });
    if (offersError) {
      // Older databases may not have the boost columns yet.
      const retry = await supabase
        .from("assignment_offers")
        .select(
          "id, status, offered_pay, message, scheduled_events ( title, sport, starts_at, zip_code, city, state, organizer_member_id )"
        )
        .eq("ref_member_id", user.id)
        .order("created_at", { ascending: false });
      o = retry.data as typeof o;
      offersError = retry.error;
    }

    const offerRows = (o as unknown as OfferRow[]) || [];
    const organizerIds = Array.from(
      new Set(
        offerRows
          .map((offer) => {
            const ev = Array.isArray(offer.scheduled_events)
              ? offer.scheduled_events[0]
              : offer.scheduled_events;
            return (ev as { organizer_member_id?: string } | null | undefined)?.organizer_member_id;
          })
          .filter((id): id is string => Boolean(id))
      )
    );

    let organizerById = new Map<string, { display_name: string | null; profile_picture_url: string | null }>();
    if (organizerIds.length > 0) {
      const { data: organizers } = await supabase
        .from("members")
        .select("id, display_name, profile_picture_url")
        .in("id", organizerIds);
      organizerById = new Map(
        (organizers ?? []).map((row) => [
          row.id,
          {
            display_name: row.display_name ?? null,
            profile_picture_url: (row as { profile_picture_url?: string | null }).profile_picture_url ?? null,
          },
        ])
      );
    }

    setOffers(
      offerRows.map((offer) => {
        const ev = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
        const organizerId = (ev as { organizer_member_id?: string } | null | undefined)?.organizer_member_id;
        const organizer = organizerId ? organizerById.get(organizerId) : null;
        return {
          ...offer,
          organizer: organizer
            ? {
                displayName: organizer.display_name,
                profilePictureUrl: organizer.profile_picture_url,
              }
            : null,
        };
      }) as unknown as OfferRow[]
    );

    const { data: apps } = await supabase
      .from("event_signup_requests")
      .select(
        "id, event_id, status, created_at, scheduled_events ( title, sport, starts_at, city, state, zip_code )"
      )
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false });
    setApplications((apps as unknown as RefWorkApplication[]) || []);

    let { data: bks, error: bksError } = await supabase
      .from("bookings")
      .select(
        "id, event_id, status, scheduled_events ( title, sport, starts_at, ends_at, city, state, zip_code, venue_street, venue_unit, notes )"
      )
      .eq("ref_member_id", user.id)
      .order("created_at", { ascending: false });
    if (bksError && (bksError.message.includes("venue_street") || bksError.message.includes("venue_unit"))) {
      const fallback = await supabase
        .from("bookings")
        .select(
          "id, event_id, status, scheduled_events ( title, sport, starts_at, ends_at, city, state, zip_code, notes )"
        )
        .eq("ref_member_id", user.id)
        .order("created_at", { ascending: false });
      bks = fallback.data as typeof bks;
    }
    setBookings((bks as unknown as RefWorkBooking[]) || []);

    const { data: av } = await supabase
      .from("ref_availability")
      .select("id, start_at, end_at")
      .eq("ref_member_id", user.id)
      .order("start_at", { ascending: true });
    setSlots(av || []);

    const profileResult = await supabase
      .from("ref_profiles")
      .select(
        "rate_per_game, rate_type, rate_min, rate_max, primary_sport, additional_sports, is_assignor, certification_level, additional_certification_levels, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
      )
      .eq("member_id", user.id)
      .maybeSingle();
    let rp = profileResult.data;
    const rpErr = profileResult.error;
    if (rpErr?.message.includes("rate_type") || rpErr?.message.includes("additional_certification_levels")) {
      const legacy = await supabase
        .from("ref_profiles")
        .select(
          "rate_per_game, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
        )
        .eq("member_id", user.id)
        .maybeSingle();
      rp = legacy.data as typeof rp;
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
      setAdditionalCerts(
        Array.isArray((rp as { additional_certification_levels?: string[] }).additional_certification_levels)
          ? (rp as { additional_certification_levels: string[] }).additional_certification_levels
          : []
      );
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

    try {
      const ratingsRes = await fetch(`/api/ratings?refMemberId=${encodeURIComponent(user.id)}`);
      const ratingsJson = (await ratingsRes.json()) as {
        average?: number | null;
        count?: number;
        reviews?: PublicReview[];
      };
      if (ratingsRes.ok) {
        setMyRatingAverage(ratingsJson.average ?? null);
        setMyRatingCount(ratingsJson.count ?? 0);
        setMyReviews(ratingsJson.reviews ?? []);
      } else {
        setMyRatingAverage(null);
        setMyRatingCount(0);
        setMyReviews([]);
      }
    } catch {
      setMyRatingAverage(null);
      setMyRatingCount(0);
      setMyReviews([]);
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
    setIsAssignor,
    setLoading,
    setOffers,
    setApplications,
    setBookings,
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

    // If admin decides while the resubmit wizard is open, close it so the popup can show.
    if (profileWizard?.mode === "resubmit") {
      if (refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps)) return;
      setProfileWizard(null);
    } else if (profileWizard) {
      return;
    }

    // Always re-prompt when GotRefs asked for fixes — don't hide after dismiss until they resubmit.
    if (refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps)) {
      setVerificationNotice({
        type: "fix_required",
        title: resubmitNoticeTitle(verificationFixRequiredSteps),
        message:
          verificationAdminNotes ||
          "GotRefs needs you to update part of your application. Complete the steps we flagged and resubmit.",
        items: REF_VERIFICATION_STEPS.filter((step) =>
          verificationFixRequiredSteps.includes(step.key)
        ).map((step) => `${step.number}. ${step.shortLabel}`),
      });
      return;
    }

    const fingerprint = `${verificationStatus}:${verificationReviewedAt ?? verificationNotesUpdatedAt ?? ""}:${verificationAdminNotes ?? ""}`;
    const storageKey = `gotrefs-ref-verification-notice-seen:${memberId}`;
    if (window.localStorage.getItem(storageKey) === fingerprint) return;

    if (refVerificationApproved(verificationStatus)) {
      setVerificationNotice({
        type: "approved",
        title: "You've been approved",
        message:
          verificationAdminNotes ||
          "Your GotRefs verification is approved. You can now request to work games and receive invites from organizers.",
      });
      return;
    }

    if (refVerificationRejected(verificationStatus)) {
      setVerificationNotice({
        type: "rejected",
        message:
          verificationAdminNotes ||
          "Your verification was not approved. Please contact GotRefs support if you have questions.",
      });
    }
  }, [
    loading,
    memberId,
    profileWizard,
    verificationStatus,
    verificationReviewedAt,
    verificationNotesUpdatedAt,
    verificationAdminNotes,
    verificationFixRequiredSteps,
  ]);

  useEffect(() => {
    if (loading || !memberId || profileWizard || verificationNotice || applicationDecisionNotice) return;

    const decisionId = searchParams.get("decision");
    const outcomeParam = searchParams.get("outcome");
    const storageKey = `gotrefs-ref-application-decision-seen:${memberId}`;
    const seen = new Set((window.localStorage.getItem(storageKey) || "").split(",").filter(Boolean));

    const showNotice = (app: (typeof applications)[number]) => {
      const ev = Array.isArray(app.scheduled_events) ? app.scheduled_events[0] : app.scheduled_events;
      const title = ev?.title || "your game";
      const when = ev?.starts_at ? new Date(ev.starts_at).toLocaleString() : "";
      const place = [ev?.city, ev?.state].filter(Boolean).join(", ") || ev?.zip_code || "";
      if (app.status === "accepted") {
        setApplicationDecisionNotice({
          type: "accepted",
          title: `You've been approved for ${title}`,
          message: `You're approved${place ? ` in ${place}` : ""}${when ? ` · ${when}` : ""}. Open Trips → Upcoming for the full address and organizer info.`,
        });
      } else {
        setApplicationDecisionNotice({
          type: "declined",
          title: `Not selected for ${title}`,
          message:
            "This organizer didn't approve your request for that game. It won't show on your open games list anymore — keep browsing other games.",
        });
      }
      seen.add(app.id);
      window.localStorage.setItem(storageKey, Array.from(seen).slice(-40).join(","));
    };

    if (decisionId) {
      const matched = applications.find((app) => app.id === decisionId);
      if (matched && (matched.status === "accepted" || matched.status === "declined")) {
        showNotice(matched);
        return;
      }
      if (outcomeParam === "accepted" || outcomeParam === "declined") {
        setApplicationDecisionNotice({
          type: outcomeParam,
          title:
            outcomeParam === "accepted"
              ? "You've been approved"
              : "Your request was not approved",
          message:
            outcomeParam === "accepted"
              ? "The organizer approved your request. Open Trips → Upcoming for game details."
              : "The organizer did not select you for this game. Keep browsing other open games.",
        });
        seen.add(decisionId);
        window.localStorage.setItem(storageKey, Array.from(seen).slice(-40).join(","));
        return;
      }
    }

    const decided = applications.filter(
      (app) => app.status === "accepted" || app.status === "declined"
    );
    if (decided.length === 0) return;
    const next = decided.find((app) => !seen.has(app.id));
    if (!next) return;
    showNotice(next);
  }, [
    loading,
    memberId,
    profileWizard,
    verificationNotice,
    applicationDecisionNotice,
    applications,
    searchParams,
  ]);

  function dismissVerificationNotice() {
    if (!memberId) {
      setVerificationNotice(null);
      return;
    }

    const noticeType = verificationNotice?.type;
    setVerificationNotice(null);

    if (noticeType === "fix_required" && verificationFixRequiredSteps.length > 0) {
      setProfileWizard({
        mode: "resubmit",
        initialStep: verificationFixRequiredSteps[0],
        steps: verificationFixRequiredSteps,
        adminMessage: verificationAdminNotes || "GotRefs requested updates to your application.",
      });
      return;
    }

    const fingerprint = `${verificationStatus}:${verificationReviewedAt ?? verificationNotesUpdatedAt ?? ""}:${verificationAdminNotes ?? ""}`;
    window.localStorage.setItem(`gotrefs-ref-verification-notice-seen:${memberId}`, fingerprint);

    if (noticeType === "approved") {
      window.requestAnimationFrame(() => {
        gamesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function handleProfileWizardComplete() {
    const wasResubmit = profileWizard?.mode === "resubmit";
    await load();
    setProfileWizard(null);
    setMsg(
      wasResubmit
        ? "Application successfully submitted — we'll review your updates within 1-2 business days."
        : "Profile updated."
    );
    if (!verificationSubmitted && govIdPath && certDocPath && profileReady) {
      await submitVerificationPackage();
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function openProfileWizard(field: EditableRefCardField) {
    if (field === "photo") {
      // Photo is handled by the direct file picker on the ID card.
      return;
    }
    const mapped = mapCardFieldToVerificationStep(field);
    if (mapped === "availability") {
      window.requestAnimationFrame(() => {
        marketplaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    setProfileWizard({
      mode: "edit",
      initialStep: mapped,
      steps: ALL_REF_VERIFICATION_STEP_KEYS,
    });
  }

  async function uploadProfilePhoto(file: File) {
    if (!memberId) return;
    setMsg(null);
    // Show the photo on the card immediately while upload finishes.
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return localPreview;
    });
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
      const safeExt = ext && ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${memberId}/profile_photo_${Date.now()}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("verification_documents")
        .upload(path, file, { upsert: true, contentType: file.type || `image/${safeExt}` });
      if (upErr) {
        setMsg(upErr.message);
        return;
      }
      const { error: updateErr } = await supabase
        .from("members")
        .update({ profile_picture_url: path })
        .eq("id", memberId);
      if (updateErr) {
        setMsg(updateErr.message);
        return;
      }
      await supabase.auth.updateUser({
        data: { profile_picture_url: path },
      });
      const signed = await resolveProfilePhotoUrl(supabase, path);
      if (signed) {
        setAvatarUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return signed;
        });
      } else {
        // Keep the local preview if signed URL generation fails.
        setMsg("Profile photo saved. If it disappears after refresh, try uploading again.");
        return;
      }
      setMsg("Profile photo added to your GotRefs ID card.");
      window.setTimeout(() => {
        void publishIdCardPhoto();
      }, 600);
    } catch {
      setMsg("Could not upload your photo. Try again.");
    }
  }

  function openResubmitWizard() {
    if (verificationFixRequiredSteps.length === 0) return;
    setProfileWizard({
      mode: "resubmit",
      initialStep: verificationFixRequiredSteps[0],
      steps: verificationFixRequiredSteps,
      adminMessage: verificationAdminNotes || "GotRefs requested updates to your application.",
    });
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const refreshVerificationStatus = useCallback(async () => {
    if (!memberId) return;
    const { data: vs, error: vsError } = await supabase
      .from("ref_verification_submissions")
      .select("status, admin_notes, updated_at, reviewed_at, fix_required_steps, resubmitted_at")
      .eq("ref_member_id", memberId)
      .maybeSingle();

    let submission: {
      status?: string | null;
      admin_notes?: string | null;
      updated_at?: string | null;
      reviewed_at?: string | null;
      fix_required_steps?: unknown;
    } | null = vs;

    if (vsError?.message.includes("fix_required_steps")) {
      const fallback = await supabase
        .from("ref_verification_submissions")
        .select("status, admin_notes, updated_at, reviewed_at")
        .eq("ref_member_id", memberId)
        .maybeSingle();
      submission = fallback.data;
    } else if (vsError) {
      return;
    }

    setVerificationStatus(submission?.status || "draft");
    setVerificationAdminNotes(submission?.admin_notes?.trim() || null);
    setVerificationNotesUpdatedAt(submission?.updated_at || null);
    setVerificationReviewedAt(submission?.reviewed_at || null);
    setVerificationFixRequiredSteps(normalizeFixRequiredSteps(submission?.fix_required_steps));
  }, [memberId, supabase]);

  // Live updates: when admin approves/rejects, the popup appears without a manual refresh.
  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel(`ref-verification-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ref_verification_submissions",
          filter: `ref_member_id=eq.${memberId}`,
        },
        () => {
          void refreshVerificationStatus();
        }
      )
      .subscribe();

    const waitingForDecision =
      refVerificationPendingReview(verificationStatus) ||
      refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps);

    const pollId = waitingForDecision
      ? window.setInterval(() => {
          void refreshVerificationStatus();
        }, 8000)
      : null;

    return () => {
      void supabase.removeChannel(channel);
      if (pollId) window.clearInterval(pollId);
    };
  }, [
    memberId,
    supabase,
    refreshVerificationStatus,
    verificationStatus,
    verificationFixRequiredSteps,
  ]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel || loading) return;
    if (panel === "offers" || panel === "my-work") {
      window.requestAnimationFrame(() => {
        marketplaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [loading, searchParams]);

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
      setMsg("Finish your profile details next.");
      openProfileWizard("profile");
      return;
    }
    if (!nextGovIdPath) {
      setMsg("Next, upload your government ID.");
      openProfileWizard("verification");
      return;
    }
    if (!nextCertDocPath) {
      setMsg("Next, upload your certification.");
      openProfileWizard("verification");
      return;
    }
    if (!nextBackgroundReady) {
      setMsg("Next, submit your verification package.");
      openProfileWizard("verification");
      return;
    }

    setMsg("Success, Find Games Now!");
    window.requestAnimationFrame(() => {
      gamesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const missingActions: {
    label: string;
    description: string;
    field: EditableRefCardField;
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
        },
        !certificationReady && {
          label: "Certification",
          description: "Upload NFHS, state association, or league credentials.",
          field: "verification" as const,
        },
        !verificationSubmitted && {
          label: "Submit for review",
          description: "Submit your verification package after your documents are uploaded.",
          field: "verification" as const,
        },
      ].filter(Boolean) as {
        label: string;
        description: string;
        field: EditableRefCardField;
      }[]);
  const availabilitySummary = formatAvailabilityForCard(slots);
  const avatarLabel = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "REF";

  if (loading) {
    return <p className="text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {applicationDecisionNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className={`w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ${
              applicationDecisionNotice.type === "accepted"
                ? "border border-green-200"
                : "border border-neutral-200"
            }`}
          >
            <p
              className={`text-xs font-black uppercase tracking-[0.18em] ${
                applicationDecisionNotice.type === "accepted" ? "text-green-700" : "text-neutral-500"
              }`}
            >
              {applicationDecisionNotice.type === "accepted" ? "Game approved" : "Request update"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--navy)]">
              {applicationDecisionNotice.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--slate)]">{applicationDecisionNotice.message}</p>
            <button
              type="button"
              onClick={() => {
                const wasAccepted = applicationDecisionNotice.type === "accepted";
                setApplicationDecisionNotice(null);
                const url = new URL(window.location.href);
                url.searchParams.delete("decision");
                url.searchParams.delete("outcome");
                window.history.replaceState({}, "", url.pathname + url.search);
                if (wasAccepted) {
                  router.push("/dashboard/referee?panel=trips");
                }
              }}
              className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black text-white ${
                applicationDecisionNotice.type === "accepted" ? "bg-green-600" : "bg-[var(--navy)]"
              }`}
            >
              {applicationDecisionNotice.type === "accepted" ? "View upcoming games" : "Got it"}
            </button>
          </div>
        </div>
      )}

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
                ? verificationNotice.title || "You've been approved"
                : verificationNotice.type === "fix_required"
                  ? verificationNotice.title || "Please fix and resubmit your application"
                  : "Verification not approved"}
            </h2>
            {verificationNotice.type === "fix_required" && (
              <p className="mt-2 text-sm font-semibold text-amber-900">
                From GotRefs review:
              </p>
            )}
            <p className="mt-2 text-sm leading-6 text-[var(--slate)]">{verificationNotice.message}</p>
            {verificationNotice.type === "fix_required" && verificationNotice.items && verificationNotice.items.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-[var(--navy)]">
                {verificationNotice.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
              {verificationNotice.type === "approved"
                ? "Browse games"
                : verificationNotice.type === "fix_required"
                  ? `Resubmit ${formatFixRequiredStepLabels(verificationFixRequiredSteps)}`
                  : "Got it"}
            </button>
          </div>
        </div>
      )}

      {profileWizard && memberId && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/55 p-4">
          <div className="mx-auto flex min-h-full max-w-2xl items-start py-6">
            <RefVerificationResubmitFlow
              memberId={memberId}
              mode={profileWizard.mode}
              steps={profileWizard.steps}
              initialStep={profileWizard.initialStep}
              adminMessage={profileWizard.adminMessage}
              existingGovId={Boolean(govIdPath)}
              existingCert={Boolean(certDocPath)}
              existingAvatarUrl={avatarUrl}
              initialHourlyRateMin={rateMin || "10"}
              initialHourlyRateMax={rateMax || rateMin || "75"}
              displayName={displayName}
              primarySport={sport}
              additionalSports={additionalSports}
              certificationLevel={cert}
              additionalCertificationLevels={additionalCerts}
              certifiedBy={cardMeta.certifiedBy ?? ""}
              baseCity={cardMeta.baseCity ?? ""}
              travelRadius={cardMeta.travelRadius ?? ""}
              workRegions={cardMeta.workRegions ?? []}
              gotrefsId={cardMeta.gotrefsId}
              onProfilePhotoUpdated={(previewUrl) => {
                setAvatarUrl((prev) => {
                  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                  return previewUrl;
                });
              }}
              onComplete={() => void handleProfileWizardComplete()}
              onClose={() => {
                setProfileWizard(null);
                void load();
                if (verificationFixRequiredSteps.length > 0) {
                  setVerificationNotice({
                    type: "fix_required",
                    title: resubmitNoticeTitle(verificationFixRequiredSteps),
                    message:
                      verificationAdminNotes ||
                      "GotRefs needs you to update part of your application. Complete the steps we flagged and resubmit.",
                    items: REF_VERIFICATION_STEPS.filter((step) =>
                      verificationFixRequiredSteps.includes(step.key)
                    ).map((step) => `${step.number}. ${step.shortLabel}`),
                  });
                }
              }}
            />
          </div>
        </div>
      )}

      {msg && <p className="rounded-lg bg-white px-4 py-2 text-sm text-[var(--navy)] shadow-sm">{msg}</p>}

      {!profileWizard && (
        <section ref={marketplaceRef}>
          <RefMarketplaceHub
            canApplyToEvents={canApplyToGames}
            applicationPending={showPendingReviewView}
            applicationRejected={verificationRejected}
            onRequireProfile={() => {
              if (showPendingReviewView) return;
              const next = missingActions[0];
              if (next) openProfileWizard(next.field);
            }}
            onReload={load}
            offers={offers}
            applications={applications}
            bookings={bookings}
          />
        </section>
      )}

      {!profileWizard && !canAcceptOffers ? (
        <div
          ref={gamesRef}
          className="rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-[var(--blue)]/10 p-5 shadow-sm lg:p-7"
        >
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
              ? "GotRefs flagged part of your application. Complete only the steps we listed, then resubmit for review. You can still browse open games on the map while you wait."
              : verificationRejected
                ? "You can still browse open games on the map, but you cannot request to work until verification is resolved. Check your notification inbox for details from GotRefs."
                : "Browse open games on the map below. Once approved, you will be able to request to work. Approvals take 1-2 business days."}
          </p>
          {verificationNeedsFix && !profileWizard && (
            <button
              type="button"
              onClick={openResubmitWizard}
              className="mt-4 rounded-full bg-amber-600 px-5 py-2.5 text-sm font-black text-white"
            >
              Fix & resubmit application
            </button>
          )}
        </div>
      ) : !profileWizard ? (
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
            {memberId ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">Your host reviews</p>
                <div className="mt-1">
                  <RefReviewsButton
                    refMemberId={memberId}
                    title={displayName || `Official ${cardMeta.gotrefsId ?? ""}`}
                    average={myRatingAverage}
                    count={myRatingCount}
                    initialReviews={myReviews}
                    emptyLabel="No reviews yet"
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Organizers rate you after completed games. Tap your stars to read comments.
                </p>
              </div>
            ) : null}
          </div>
          <div>
            <RefereeIdCard
              cardRef={idCardRef}
              fullName={displayName}
              gotrefsId={cardMeta.gotrefsId}
              primarySport={sport}
              additionalSports={additionalSports}
              certificationLevel={cert}
              additionalCertificationLevels={additionalCerts}
              certifiedBy={cardMeta.certifiedBy || cert || undefined}
              rate={rateLabel()}
              avatarUrl={avatarUrl ?? undefined}
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
              validThrough={
                refVerificationApproved(verificationStatus)
                  ? formatCardValidThrough(verificationReviewedAt)
                  : null
              }
              onEditField={(field) => openProfileWizard(field)}
              onUploadPhoto={(file) => void uploadProfilePhoto(file)}
            />
          </div>
        </div>
      ) : null}

      {!dismissOfferQueue && pendingOffers.length > 0 && (
        <PendingOfferQueueModal
          offers={pendingOffers}
          onClose={() => setDismissOfferQueue(true)}
          onRespond={async (offerId, action) => {
            try {
              const res = await fetch(`/api/offers/${offerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
              });
              const json = (await res.json()) as { error?: string };
              if (!res.ok) {
                setMsg(json.error || "Could not update this invite.");
                return false;
              }
              setMsg(
                action === "accept"
                  ? "Invite accepted — venue details unlocked on your Upcoming games."
                  : "Invite declined."
              );
              await load();
              return true;
            } catch {
              setMsg("Could not reach the server. Try again.");
              return false;
            }
          }}
        />
      )}

    </div>
  );
}
