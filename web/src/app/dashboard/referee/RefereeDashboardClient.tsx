"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { RefVerificationResubmitFlow } from "@/components/RefVerificationResubmitFlow";
import { RefMarketplaceHub } from "@/components/marketplace/RefMarketplaceHub";
import type { RefWorkApplication, RefWorkBooking } from "@/components/marketplace/RefMyWorkPanel";
import { RefereeIdCard, type EditableRefCardField } from "@/components/RefereeIdCard";
import { RefReviewsButton } from "@/components/reviews/RefReviewsButton";
import type { PublicReview } from "@/components/reviews/ReviewsModal";
import { BRAND_NAME } from "@/lib/brand";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { downloadRefIdCardPdf, formatCardValidThrough } from "@/lib/ref-id-card-pdf";
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
  const notificationsRef = useRef<HTMLElement | null>(null);
  const messagesRef = useRef<HTMLElement | null>(null);
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
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [assignorRecommendOpen, setAssignorRecommendOpen] = useState(false);
  const [assignorName, setAssignorName] = useState("");
  const [assignorEmail, setAssignorEmail] = useState("");
  const [assignorPhone, setAssignorPhone] = useState("");
  const [savingAssignorRec, setSavingAssignorRec] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [isAssignor, setIsAssignor] = useState(false);
  const [assignorSaving, setAssignorSaving] = useState(false);
  const [rosterEntries, setRosterEntries] = useState<AssignorRosterEntry[]>([]);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [myRatingAverage, setMyRatingAverage] = useState<number | null>(null);
  const [myRatingCount, setMyRatingCount] = useState(0);
  const [myReviews, setMyReviews] = useState<PublicReview[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    const photoSource =
      memberRow?.profile_picture_url ||
      (typeof meta.profile_picture_url === "string" ? meta.profile_picture_url : null) ||
      (typeof meta.avatar_url === "string" ? meta.avatar_url : null);
    setAvatarUrl(await resolveProfilePhotoUrl(supabase, photoSource));
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
        "rate_per_game, rate_type, rate_min, rate_max, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path, recommended_assignor_name, recommended_assignor_email, recommended_assignor_phone"
      )
      .eq("member_id", user.id)
      .maybeSingle();
    let rp = profileResult.data as
      | (NonNullable<typeof profileResult.data> & {
          recommended_assignor_name?: string | null;
          recommended_assignor_email?: string | null;
          recommended_assignor_phone?: string | null;
        })
      | null;
    const rpErr = profileResult.error;
    if (rpErr?.message.includes("recommended_assignor") || rpErr?.message.includes("rate_type")) {
      const fallback = await supabase
        .from("ref_profiles")
        .select(
          "rate_per_game, rate_type, rate_min, rate_max, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
        )
        .eq("member_id", user.id)
        .maybeSingle();
      rp = fallback.data as typeof rp;
      if (fallback.error?.message.includes("rate_type")) {
        const legacy = await supabase
          .from("ref_profiles")
          .select(
            "rate_per_game, primary_sport, additional_sports, is_assignor, certification_level, bio, verification_method, external_verifier_name, external_verification_proof_path, government_id_path, certification_document_path, verification_doc_path"
          )
          .eq("member_id", user.id)
          .maybeSingle();
        rp = legacy.data as typeof rp;
      }
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
      setAssignorName(rp.recommended_assignor_name?.trim() || "");
      setAssignorEmail(rp.recommended_assignor_email?.trim() || "");
      setAssignorPhone(rp.recommended_assignor_phone?.trim() || "");
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
    setInquiries,
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
    if (loading || !memberId || profileWizard) return;

    // Always re-prompt when GotREFS asked for fixes — don't hide after dismiss until they resubmit.
    if (refVerificationNeedsFix(verificationStatus, verificationFixRequiredSteps)) {
      setVerificationNotice({
        type: "fix_required",
        title: resubmitNoticeTitle(verificationFixRequiredSteps),
        message:
          verificationAdminNotes ||
          "GotREFS needs you to update part of your application. Complete the steps we flagged and resubmit.",
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
        title: "Download your GotREFS ID card",
        message:
          verificationAdminNotes ||
          "You're approved. Download your digital ID card to show organizers — it's valid for one year from today.",
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
    profileWizard,
    verificationStatus,
    verificationReviewedAt,
    verificationNotesUpdatedAt,
    verificationAdminNotes,
    verificationFixRequiredSteps,
  ]);

  useEffect(() => {
    if (loading || !memberId || profileWizard || verificationNotice || applicationDecisionNotice) return;
    const decided = applications.filter(
      (app) => app.status === "accepted" || app.status === "declined"
    );
    if (decided.length === 0) return;
    const storageKey = `gotrefs-ref-application-decision-seen:${memberId}`;
    const seen = new Set((window.localStorage.getItem(storageKey) || "").split(",").filter(Boolean));
    const next = decided.find((app) => !seen.has(app.id));
    if (!next) return;
    const ev = Array.isArray(next.scheduled_events) ? next.scheduled_events[0] : next.scheduled_events;
    const title = ev?.title || "your game";
    const when = ev?.starts_at ? new Date(ev.starts_at).toLocaleString() : "";
    const place = [ev?.city, ev?.state].filter(Boolean).join(", ") || ev?.zip_code || "";
    if (next.status === "accepted") {
      setApplicationDecisionNotice({
        type: "accepted",
        title: `Approved for ${title}`,
        message: `You're approved${place ? ` in ${place}` : ""}${when ? ` · ${when}` : ""}. Open Trips → Upcoming for the full address and organizer info.`,
      });
    } else {
      setApplicationDecisionNotice({
        type: "declined",
        title: `Not selected for ${title}`,
        message: "This organizer didn't approve your request for that game. It won't show on your open games list anymore — keep browsing other games.",
      });
    }
    seen.add(next.id);
    window.localStorage.setItem(storageKey, Array.from(seen).slice(-40).join(","));
  }, [
    loading,
    memberId,
    profileWizard,
    verificationNotice,
    applicationDecisionNotice,
    applications,
  ]);

  async function downloadIdCardPdf(): Promise<boolean> {
    setDownloadingCard(true);
    try {
      const safeName = (displayName || "referee").replace(/[^\w\- ]+/g, "").trim() || "referee";
      await downloadRefIdCardPdf(
        {
          fullName: displayName,
          gotrefsId: cardMeta.gotrefsId,
          primarySport: sport,
          additionalSports,
          certificationLevel: cert,
          certifiedBy: cardMeta.certifiedBy,
          rate: rateLabel(),
          avatarUrl: avatarUrl ?? undefined,
          avatarLabel,
          baseCity: cardMeta.baseCity,
          workRegions: cardMeta.workRegions,
          travelRadius: cardMeta.travelRadius,
          availabilitySummary,
          govIdUploaded: Boolean(govIdPath),
          certUploaded: Boolean(certDocPath),
          backgroundStatus: screening?.status,
          verificationStatus,
          verificationSkipped: cardMeta.verificationSkipped,
          profileComplete,
          validThrough: refVerificationApproved(verificationStatus)
            ? formatCardValidThrough(verificationReviewedAt)
            : null,
        },
        `GotREFS-ID-${safeName.replace(/\s+/g, "-")}.pdf`
      );
      setMsg("ID card downloaded. Valid for one year from your approval date.");
      return true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setMsg(`Could not create the PDF (${detail}). Try again, or screenshot your on-screen ID card.`);
      return false;
    } finally {
      setDownloadingCard(false);
    }
  }

  async function downloadIdCardAndGoToGames() {
    await downloadIdCardPdf();
    dismissVerificationNotice();
  }

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
        adminMessage: verificationAdminNotes || "GotREFS requested updates to your application.",
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

  async function saveAssignorRecommendation() {
    if (!memberId) return;
    const name = assignorName.trim();
    const email = assignorEmail.trim();
    const phone = assignorPhone.trim();
    if (!name) {
      setMsg("Enter the assignor's name.");
      return;
    }
    if (!email && !phone) {
      setMsg("Enter the assignor's email or phone number.");
      return;
    }
    setSavingAssignorRec(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("ref_profiles")
        .update({
          recommended_assignor_name: name,
          recommended_assignor_email: email || null,
          recommended_assignor_phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", memberId);
      if (error) {
        setMsg(
          error.message.includes("recommended_assignor")
            ? "Run the latest database migration to enable assignor recommendations."
            : error.message
        );
        return;
      }
      setAssignorRecommendOpen(false);
      setMsg("Assignor recommendation saved. Thanks!");
    } finally {
      setSavingAssignorRec(false);
    }
  }

  async function handleProfileWizardComplete() {
    const wasResubmit = profileWizard?.mode === "resubmit";
    setProfileWizard(null);
    setMsg(
      wasResubmit
        ? "Application successfully submitted — we'll review your updates within 1-2 business days."
        : "Profile updated."
    );
    await load();
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
        .update({ profile_picture_url: path, updated_at: new Date().toISOString() })
        .eq("id", memberId);
      if (updateErr) {
        setMsg(updateErr.message);
        return;
      }
      const signed = await resolveProfilePhotoUrl(supabase, path);
      if (signed) {
        setAvatarUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return signed;
        });
      }
      setMsg("Profile photo added to your GotREFS ID card.");
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
      adminMessage: verificationAdminNotes || "GotREFS requested updates to your application.",
    });
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel || loading) return;
    window.requestAnimationFrame(() => {
      if (panel === "offers") notificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "messages") messagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "notifications") notificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
  const hasVerificationMailboxMessage = Boolean(verificationAdminNotes);
  const hasVerificationStatusNotice =
    verificationApproved || verificationRejected || verificationNeedsFix;
  const refNotificationCount =
    pendingOffers.length + inquiries.length + (hasVerificationMailboxMessage || hasVerificationStatusNotice ? 1 : 0);
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
                ? verificationNotice.title || "Download your GotREFS ID card"
                : verificationNotice.type === "fix_required"
                  ? verificationNotice.title || "Please fix and resubmit your application"
                  : "Verification not approved"}
            </h2>
            {verificationNotice.type === "fix_required" && (
              <p className="mt-2 text-sm font-semibold text-amber-900">
                From GotREFS review:
              </p>
            )}
            <p className="mt-2 text-sm leading-6 text-[var(--slate)]">{verificationNotice.message}</p>
            {verificationNotice.type === "approved" && (
              <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-900">
                Valid for 1 year from your approval date
                {verificationReviewedAt
                  ? ` · through ${formatCardValidThrough(verificationReviewedAt)}`
                  : ""}
                . Save the PDF to your phone to show organizers at games.
              </p>
            )}
            {verificationNotice.type === "fix_required" && verificationNotice.items && verificationNotice.items.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-[var(--navy)]">
                {verificationNotice.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {verificationNotice.type === "approved" ? (
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  disabled={downloadingCard}
                  onClick={() => void downloadIdCardAndGoToGames()}
                  className="w-full rounded-full bg-green-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {downloadingCard ? "Preparing PDF…" : "Download your ref ID card"}
                </button>
                <button
                  type="button"
                  onClick={dismissVerificationNotice}
                  className="w-full rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700"
                >
                  Skip for now — browse games
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={dismissVerificationNotice}
                className={`mt-5 w-full rounded-full px-4 py-3 text-sm font-black text-white ${
                  verificationNotice.type === "fix_required" ? "bg-amber-600" : "bg-[var(--red)]"
                }`}
              >
                {verificationNotice.type === "fix_required"
                  ? `Resubmit ${formatFixRequiredStepLabels(verificationFixRequiredSteps)}`
                  : "Got it"}
              </button>
            )}
          </div>
        </div>
      )}

      {assignorRecommendOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
              Assignor referral
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--navy)]">
              Recommended by an assignor?
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              If an assignor introduced you to GotREFS, add their name and email or phone so we can credit them.
            </p>
            <label className="mt-4 block text-sm font-bold text-[var(--navy)]">
              Assignor name
              <input
                value={assignorName}
                onChange={(e) => setAssignorName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="Full name"
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-[var(--navy)]">
              Email <span className="font-medium text-neutral-500">(or phone below)</span>
              <input
                type="email"
                value={assignorEmail}
                onChange={(e) => setAssignorEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="assignor@example.com"
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-[var(--navy)]">
              Phone
              <input
                type="tel"
                value={assignorPhone}
                onChange={(e) => setAssignorPhone(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                placeholder="(555) 555-5555"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setAssignorRecommendOpen(false)}
                className="flex-1 rounded-full border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssignorRec}
                onClick={() => void saveAssignorRecommendation()}
                className="flex-1 rounded-full bg-[var(--navy)] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {savingAssignorRec ? "Saving…" : "Save"}
              </button>
            </div>
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
              initialHourlyRateMin={rateMin || "10"}
              initialHourlyRateMax={rateMax || rateMin || "75"}
              displayName={displayName}
              primarySport={sport}
              additionalSports={additionalSports}
              certificationLevel={cert}
              baseCity={cardMeta.baseCity ?? ""}
              travelRadius={cardMeta.travelRadius ?? ""}
              workRegions={cardMeta.workRegions ?? []}
              onComplete={() => void handleProfileWizardComplete()}
              onClose={() => {
                setProfileWizard(null);
                if (verificationFixRequiredSteps.length > 0) {
                  setVerificationNotice({
                    type: "fix_required",
                    title: resubmitNoticeTitle(verificationFixRequiredSteps),
                    message:
                      verificationAdminNotes ||
                      "GotREFS needs you to update part of your application. Complete the steps we flagged and resubmit.",
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
              const next = missingStatuses[0];
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
              ? "GotREFS flagged part of your application. Complete only the steps we listed, then resubmit for review. You can still browse open games on the map while you wait."
              : verificationRejected
                ? "You can still browse open games on the map, but you cannot request to work until verification is resolved. Check your notification inbox for details from GotREFS."
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
              fullName={displayName}
              gotrefsId={cardMeta.gotrefsId}
              primarySport={sport}
              additionalSports={additionalSports}
              certificationLevel={cert}
              certifiedBy={cardMeta.certifiedBy}
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
          <div className="mt-3 flex flex-wrap gap-2">
            {refVerificationApproved(verificationStatus) && (
              <button
                type="button"
                disabled={downloadingCard}
                onClick={() => void downloadIdCardPdf()}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
              >
                {downloadingCard ? "Preparing PDF…" : "Download ID card PDF"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAssignorRecommendOpen(true)}
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {assignorName ? "Edit assignor recommendation" : "Recommended by assignor?"}
            </button>
          </div>
          {assignorName ? (
            <p className="mt-2 text-xs text-neutral-500">
              Recommended by {assignorName}
              {assignorEmail ? ` · ${assignorEmail}` : ""}
              {assignorPhone ? ` · ${assignorPhone}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

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
                onClick={openResubmitWizard}
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
          {pendingOffers.length > 0 && (
            <article className="rounded-2xl border border-red-100 bg-red-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">Organizer invites</p>
              <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                You have {pendingOffers.length} pending invite{pendingOffers.length === 1 ? "" : "s"}.
              </p>
              <button
                type="button"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("tab", "my-work");
                  window.location.assign(url.toString());
                }}
                className="mt-3 rounded-full bg-[var(--navy)] px-4 py-2 text-xs font-black text-white"
              >
                Review in My Work
              </button>
            </article>
          )}
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
