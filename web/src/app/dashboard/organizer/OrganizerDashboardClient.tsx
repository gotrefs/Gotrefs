"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AirbnbAcceptProfile, acceptPhotosForSport } from "@/components/marketplace/AirbnbAcceptProfile";
import {
  OrganizerEventComposer,
  type JustPublishedEvent,
} from "@/components/marketplace/OrganizerEventComposer";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";
import { EventMatchingView } from "@/components/organizer/EventMatchingView";
import {
  OrganizerListingWizard,
  gameLevelLabel,
  type OrganizerWizardDraft,
  type PayoutMethodPayload,
} from "@/components/organizer/OrganizerListingWizard";
import {
  ApplicantReviewModal,
  type ApplicantReviewData,
} from "@/components/organizer/ApplicantReviewModal";
import { CsvEventImportReview } from "@/components/organizer/CsvEventImportReview";
import { LeaveReviewModal } from "@/components/reviews/LeaveReviewModal";
import { SportsFields } from "@/components/SportsFields";
import { formatEventLocation, formatPayOffer } from "@/data/sports";
import { marketplaceCardShadow, sportListingVisual } from "@/lib/marketplace/airbnb-styles";
import { PLATFORM_FEE_PERCENT_LABEL, platformFeeCents as calcPlatformFeeCents } from "@/lib/platform-fee";
import {
  csvDraftToPublishBody,
  parseEventsCsv,
  type ParsedCsvEvent,
} from "@/lib/marketplace/parse-events-csv";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";

type RefReview = {
  score: number;
  comment: string | null;
  createdAt: string;
  authorLabel?: string;
};

type DirectoryRef = {
  id: string;
  gotrefsId: string;
  displayName: string;
  primarySport: string;
  additionalSports?: string[];
  certificationLevel?: string | null;
  sportEmoji: string;
  ratePerGame: number | null;
  rateType?: "exact" | "range" | null;
  rateMin?: number | null;
  rateMax?: number | null;
  rateUnit?: "hour" | "game" | null;
  homeZip: string | null;
  travelRadiusMiles?: number | null;
  availability: { start_at: string; end_at: string }[];
  maskedEmail: string;
  avatarUrl?: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  reviews?: RefReview[];
  gamesCompleted?: number;
};

function formatEventDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isMissingPayRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["pay_type", "pay_min", "pay_max"].some((column) => message.includes(column));
}

function isMissingBrandHexColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return message.includes("brand_hex_primary") || message.includes("brand_hex_secondary");
}

function isMissingOrganizerRateColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["rate_type", "rate_min", "rate_max"].some((column) => message.includes(column));
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDatetimeLocalValue(date: Date, hour: number, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  const offset = next.getTimezoneOffset() * 60000;
  return new Date(next.getTime() - offset).toISOString().slice(0, 16);
}

function toDatetimeLocalFromDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** After publish, suggest the next slot (+2h) for Add another. */
function bumpDatetimeLocal(value: string, hours = 2) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(date.getHours() + hours);
  return toDatetimeLocalFromDate(date);
}

function buildMonthWeeks(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (days.length % 7 !== 0) days.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

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
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
};

type ApplicantRow = {
  id: string;
  eventId: string;
  refMemberId: string;
  createdAt: string;
  gotrefsId: string;
  displayName?: string | null;
  primarySport?: string | null;
  additionalSports?: string[];
  certificationLevel?: string | null;
  avatarPath?: string | null;
  avatarUrl?: string | null;
  eventTitle: string;
  eventPlace?: string | null;
  eventWhen?: string | null;
  eventPayLabel: string | null;
  refRateLabel: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  reviews: RefReview[];
};

type OrganizerOfferRow = {
  id: string;
  event_id: string;
  ref_member_id: string;
  offered_pay: number | null;
  base_pay?: number | null;
  boost_percent?: number | null;
  status: string;
  message: string | null;
  created_at: string;
  members: { display_name: string } | { display_name: string }[] | null;
  scheduled_events:
    | { title: string; sport: string; starts_at: string; ends_at: string; pay_offer: number | null }
    | { title: string; sport: string; starts_at: string; ends_at: string; pay_offer: number | null }[]
    | null;
};

type RefRatingRow = {
  event_id: string;
  ref_member_id: string;
  score: number | null;
  skipped: boolean;
};

type OrganizerSetupStep = "sport" | "pay" | "bio" | "events" | "identity";
const ORGANIZER_SETUP_ORDER: OrganizerSetupStep[] = ["sport", "pay", "bio", "events", "identity"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function ratingKey(eventId: string, refMemberId: string) {
  return `${eventId}:${refMemberId}`;
}

function dollarsToCents(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function OrganizerDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const notificationsRef = useRef<HTMLElement | null>(null);
  const applicantsRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<OrganizerSetupStep>("sport");
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [payoutWizardOpen, setPayoutWizardOpen] = useState(false);
  const [payoutSet, setPayoutSet] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "calendar" | "listings" | "messages">("today");
  const [todayFilter, setTodayFilter] = useState<"today" | "upcoming">("today");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [eventMsg, setEventMsg] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [bio, setBio] = useState("");
  const [sport, setSport] = useState("");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [ratePerOfficial, setRatePerOfficial] = useState("");
  const [rateType, setRateType] = useState<"exact" | "range">("exact");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandHexPrimary, setBrandHexPrimary] = useState("");
  const [brandHexSecondary, setBrandHexSecondary] = useState("");
  const [eventsListPath, setEventsListPath] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState<JustPublishedEvent[]>([]);
  const [csvImportRows, setCsvImportRows] = useState<ParsedCsvEvent[] | null>(null);
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([]);
  const [csvPublishing, setCsvPublishing] = useState(false);

  const [title, setTitle] = useState("");
  const [eventSport, setEventSport] = useState("Basketball");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [needed, setNeeded] = useState(1);
  const [pay, setPay] = useState("");
  const [payType, setPayType] = useState<"exact" | "range">("exact");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [notes, setNotes] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [manageCalendarCursor, setManageCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedManageDate, setSelectedManageDate] = useState<Date | null>(null);
  const [refs, setRefs] = useState<DirectoryRef[]>([]);
  const [signupRequests, setSignupRequests] = useState<ApplicantRow[]>([]);
  const [reviewApplicant, setReviewApplicant] = useState<ApplicantReviewData | null>(null);
  const [sentOffers, setSentOffers] = useState<OrganizerOfferRow[]>([]);
  const [submittedRatings, setSubmittedRatings] = useState<RefRatingRow[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);
  const [leaveReviewOffer, setLeaveReviewOffer] = useState<OrganizerOfferRow | null>(null);
  const [ratingCutoffIso, setRatingCutoffIso] = useState("");
  const [offerEvent, setOfferEvent] = useState("");
  const [offerRef, setOfferRef] = useState("");
  const [offerSending, setOfferSending] = useState(false);
  const [checkoutEventId, setCheckoutEventId] = useState<string | null>(null);
  const [staffingEventId, setStaffingEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setRatingCutoffIso(new Date().toISOString());
    const meta = user.user_metadata ?? {};
    setDisplayName(
      String(meta.full_name ?? "").trim() ||
        `${String(meta.first_name ?? "").trim()} ${String(meta.last_name ?? "").trim()}`.trim() ||
        user.email?.split("@")[0] ||
        "Organizer"
    );
    setOrganizationName(String(meta.organization_name ?? "").trim() || "Organization");
    setAccountEmail(user.email ?? "");
    setPayoutSet(Boolean(meta.payout_method));

    let organizerProfileResult = await supabase
      .from("organizer_profiles")
      .select(
        "bio, primary_sport, additional_sports, rate_per_official, rate_type, rate_min, rate_max, logo_path, events_list_path, brand_hex_primary, brand_hex_secondary"
      )
      .eq("member_id", user.id)
      .maybeSingle();
    if (isMissingBrandHexColumn(organizerProfileResult.error)) {
      organizerProfileResult = await supabase
        .from("organizer_profiles")
        .select(
          "bio, primary_sport, additional_sports, rate_per_official, rate_type, rate_min, rate_max, logo_path, events_list_path"
        )
        .eq("member_id", user.id)
        .maybeSingle() as typeof organizerProfileResult;
    }
    let op = organizerProfileResult.data as
      | (NonNullable<typeof organizerProfileResult.data> & {
          brand_hex_primary?: string | null;
          brand_hex_secondary?: string | null;
        })
      | null;
    const opErr = organizerProfileResult.error;
    if (isMissingOrganizerRateColumn(opErr)) {
      const fallback = await supabase
        .from("organizer_profiles")
        .select("bio, primary_sport, additional_sports, rate_per_official, logo_path, events_list_path")
        .eq("member_id", user.id)
        .maybeSingle();
      op = fallback.data as typeof op;
    }

    if (op) {
      setBio(op.bio || "");
      setSport(op.primary_sport || "");
      setAdditionalSports(Array.isArray(op.additional_sports) ? op.additional_sports : []);
      setRatePerOfficial(op.rate_per_official != null ? String(op.rate_per_official) : "");
      setRateType(op.rate_type === "range" ? "range" : "exact");
      setRateMin(op.rate_min != null ? String(op.rate_min) : "");
      setRateMax(op.rate_max != null ? String(op.rate_max) : "");
      setLogoPath(op.logo_path);
      setBrandHexPrimary(op.brand_hex_primary ?? "");
      setBrandHexSecondary(op.brand_hex_secondary ?? "");
      setLogoUrl(await resolveProfilePhotoUrl(supabase, op.logo_path));
      setEventsListPath(op.events_list_path);

      const payConfigured =
        (op.rate_type === "range" && (op.rate_min != null || op.rate_max != null)) ||
        (op.rate_per_official != null && Number(op.rate_per_official) > 0) ||
        (op.rate_min != null && Number(op.rate_min) > 0);
      if (!(op.primary_sport || "").trim()) setSetupStep("sport");
      else if (!payConfigured) setSetupStep("pay");
      else if (!(op.bio || "").trim()) setSetupStep("bio");
      else if (!op.logo_path) setSetupStep("identity");
    } else {
      setLogoUrl(null);
      setBrandHexPrimary("");
      setBrandHexSecondary("");
    }

    const eventResult = await supabase
      .from("scheduled_events")
      .select(
        "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, pay_type, pay_min, pay_max, venue_lat, venue_lng"
      )
      .eq("organizer_member_id", user.id)
      .order("starts_at", { ascending: true });
    let ev = eventResult.data;
    const evErr = eventResult.error;
    if (isMissingPayRangeColumn(evErr) || (evErr?.message ?? "").includes("venue_lat")) {
      const fallback = await supabase
        .from("scheduled_events")
        .select("id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer")
        .eq("organizer_member_id", user.id)
        .order("starts_at", { ascending: true });
      ev = fallback.data as typeof ev;
    }
    setEvents((ev as EventRow[]) || []);

    const applicantsRes = await fetch("/api/organizer/applicants");
    const applicantsJson = (await applicantsRes.json()) as { applicants?: ApplicantRow[] };
    const applicants = applicantsJson.applicants ?? [];
    const withAvatars = await Promise.all(
      applicants.map(async (row) => ({
        ...row,
        avatarUrl: row.avatarPath
          ? await resolveProfilePhotoUrl(supabase, row.avatarPath)
          : null,
      }))
    );
    setSignupRequests(withAvatars);

    let { data: offers, error: offersError } = await supabase
      .from("assignment_offers")
      .select(
        "id, event_id, ref_member_id, offered_pay, base_pay, boost_percent, status, message, created_at, members ( display_name ), scheduled_events!inner ( title, sport, starts_at, ends_at, pay_offer, organizer_member_id )"
      )
      .eq("scheduled_events.organizer_member_id", user.id)
      .order("created_at", { ascending: false });
    if (offersError) {
      // Older databases may not have the boost columns yet.
      const retry = await supabase
        .from("assignment_offers")
        .select(
          "id, event_id, ref_member_id, offered_pay, status, message, created_at, members ( display_name ), scheduled_events!inner ( title, sport, starts_at, ends_at, pay_offer, organizer_member_id )"
        )
        .eq("scheduled_events.organizer_member_id", user.id)
        .order("created_at", { ascending: false });
      offers = retry.data as typeof offers;
      offersError = retry.error;
    }
    setSentOffers((offers as unknown as OrganizerOfferRow[]) || []);

    const { data: ratings } = await supabase
      .from("ref_ratings")
      .select("event_id, ref_member_id, score, skipped")
      .eq("organizer_member_id", user.id);
    setSubmittedRatings((ratings as RefRatingRow[]) || []);

    try {
      const dirRes = await fetch("/api/refs/directory");
      const dirJson = (await dirRes.json()) as {
        canContact?: boolean;
        refs?: DirectoryRef[];
      };
      setRefs(dirJson.refs ?? []);
    } catch {
      setRefs([]);
    }

    setLoading(false);
  }, [
    supabase,
    setAccountEmail,
    setAdditionalSports,
    setBio,
    setDisplayName,
    setEvents,
    setEventsListPath,
    setLoading,
    setLogoPath,
    setOrganizationName,
    setRatePerOfficial,
    setRefs,
    setSentOffers,
    setSubmittedRatings,
    setRatingCutoffIso,
    setSignupRequests,
    setSport,
  ]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel || loading) return;
    window.requestAnimationFrame(() => {
      if (panel === "requests") applicantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "responses") notificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (panel === "marketplace") setActiveTab("listings");
    });
  }, [loading, searchParams]);

  useEffect(() => {
    if (loading) return;
    const requestId = searchParams.get("request");
    if (requestId) {
      if (reviewApplicant?.id === requestId) return;
      const match = signupRequests.find((row) => row.id === requestId);
      if (match) {
        setReviewApplicant({
          id: match.id,
          eventId: match.eventId,
          refMemberId: match.refMemberId,
          gotrefsId: match.gotrefsId,
          displayName: null,
          primarySport: match.primarySport,
          additionalSports: match.additionalSports,
          certificationLevel: match.certificationLevel,
          avatarUrl: match.avatarUrl,
          eventTitle: match.eventTitle,
          eventPlace: match.eventPlace,
          eventWhen: match.eventWhen,
          eventPayLabel: match.eventPayLabel,
          refRateLabel: match.refRateLabel,
          ratingAverage: match.ratingAverage,
          ratingCount: match.ratingCount,
          reviews: match.reviews,
        });
      }
      return;
    }
    if (signupRequests.length === 0 || reviewApplicant) return;
    const seenKey = `gotrefs-org-request-popup-seen:${accountEmail || "org"}`;
    const seen = window.localStorage.getItem(seenKey) || "";
    const next = signupRequests.find((row) => !seen.split(",").includes(row.id));
    if (next) {
      setReviewApplicant({
        id: next.id,
        eventId: next.eventId,
        refMemberId: next.refMemberId,
        gotrefsId: next.gotrefsId,
        displayName: null,
        primarySport: next.primarySport,
        additionalSports: next.additionalSports,
        certificationLevel: next.certificationLevel,
        avatarUrl: next.avatarUrl,
        eventTitle: next.eventTitle,
        eventPlace: next.eventPlace,
        eventWhen: next.eventWhen,
        eventPayLabel: next.eventPayLabel,
        refRateLabel: next.refRateLabel,
        ratingAverage: next.ratingAverage,
        ratingCount: next.ratingCount,
        reviews: next.reviews,
      });
      window.localStorage.setItem(seenKey, `${seen},${next.id}`.replace(/^,/, "").slice(-800));
    }
  }, [loading, signupRequests, searchParams, accountEmail, reviewApplicant]);

  async function decideApplicant(applicantId: string, action: "accept" | "decline"): Promise<boolean | string> {
    try {
      const res = await fetch(`/api/organizer/applicants/${applicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        const detail = j.error || `Could not ${action} this application.`;
        setMsg(detail);
        return detail;
      }
      setMsg(
        action === "accept"
          ? "Ref approved for this game. They’ll see it under Upcoming and get an email."
          : "Request denied. The ref was emailed and won’t see this game anymore."
      );
      setReviewApplicant(null);
      await load();
      return true;
    } catch {
      const detail = "Could not reach the server.";
      setMsg(detail);
      return detail;
    }
  }

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const message =
      checkout === "success"
        ? "Payment complete. Stripe is holding the booking funds for this event."
        : checkout === "cancelled"
          ? "Stripe checkout was cancelled. You can restart payment from the event card."
          : null;
    if (!message) return;
    const frame = window.requestAnimationFrame(() => setMsg(message));
    return () => window.cancelAnimationFrame(frame);
  }, [searchParams]);

  function hasOrganizerPay() {
    return Boolean(ratePerOfficial.trim());
  }

  function isOrganizerProfileComplete() {
    return Boolean(sport.trim() && hasOrganizerPay() && bio.trim() && logoPath);
  }

  function firstIncompleteOrganizerSetupStep(): OrganizerSetupStep {
    if (!sport.trim()) return "sport";
    if (!hasOrganizerPay()) return "pay";
    if (!bio.trim()) return "bio";
    if (!logoPath) return "identity";
    return "events";
  }

  function requireOrganizerOnboarding() {
    if (isOrganizerProfileComplete()) return true;
    setWizardOpen(true);
    setMsg("Finish your organizer listing first so refs know who they are working with.");
    return false;
  }

  function finishOrganizerSetup() {
    if (!logoPath) {
      setMsg("Upload your organization logo to finish.");
      return;
    }
    setSetupModalOpen(false);
    setMsg("Organizer profile ready.");
  }

  function openSetup(step: OrganizerSetupStep) {
    // Event posting always uses the Airbnb-style listing wizard.
    if (step === "events") {
      setJustPublished([]);
      setEventMsg(null);
      setWizardOpen(true);
      return;
    }
    setSetupStep(step);
    setSetupModalOpen(true);
  }

  function finishEventsStep() {
    const publishedCount = justPublished.length;
    setJustPublished([]);
    setEventMsg(null);
    if (!isOrganizerProfileComplete()) {
      goToNextSetupStep("events");
      return;
    }
    setSetupModalOpen(false);
    setMsg(publishedCount > 0 ? "Events ready — staff them from Upcoming." : null);
  }

  function browseRefsForEvent(eventId: string) {
    openStaffingForEvent(eventId);
  }

  function openStaffingForEvent(eventId: string) {
    if (!requireOrganizerOnboarding()) return;
    const owned = events.some((event) => event.id === eventId);
    if (!owned) {
      setMsg("You can only hire refs for your own events.");
      return;
    }
    setStaffingEventId(eventId);
    setOfferEvent(eventId);
    setOfferRef("");
  }

  function prefillEventDate(date: Date) {
    setStarts(toDatetimeLocalValue(date, 18));
    setEnds(toDatetimeLocalValue(date, 20));
    clearEventFeedback();
    // Airbnb-style full listing wizard — not the legacy setup modal.
    setWizardOpen(true);
  }

  function goToNextSetupStep(current: OrganizerSetupStep) {
    const index = ORGANIZER_SETUP_ORDER.indexOf(current);
    const next = ORGANIZER_SETUP_ORDER[Math.min(ORGANIZER_SETUP_ORDER.length - 1, index + 1)];
    setSetupStep(next);
  }

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

  async function saveProfileAndAdvance(current: OrganizerSetupStep) {
    setMsg(null);
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const rateNum = ratePerOfficial === "" ? null : Number(ratePerOfficial);
      const minNum = rateMin === "" ? null : Number(rateMin);
      const maxNum = rateMax === "" ? null : Number(rateMax);
      const res = await fetch("/api/organizer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio,
          primary_sport: sport,
          additional_sports: additionalSports,
          rate_per_official:
            rateType === "range" && Number.isFinite(minNum as number)
              ? minNum
              : Number.isFinite(rateNum as number)
                ? rateNum
                : null,
          rate_type: rateType,
          rate_min: rateType === "range" && Number.isFinite(minNum as number) ? minNum : null,
          rate_max: rateType === "range" && Number.isFinite(maxNum as number) ? maxNum : null,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      const toleratedRateSchemaError = !res.ok && isMissingOrganizerRateColumn({ message: json.error });
      const savedOrSafeToAdvance = res.ok || toleratedRateSchemaError;
      const text = savedOrSafeToAdvance ? "Organization profile saved." : json.error || "Could not save profile.";
      setProfileMsg(text);
      setMsg(text);
      if (savedOrSafeToAdvance) {
        if (res.ok) await load();
        goToNextSetupStep(current);
      }
    } catch {
      const text = "Could not reach the server. Refresh and try again.";
      setProfileMsg(text);
      setMsg(text);
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadLogoFile(file);
  }

  async function uploadLogoFile(file: File) {
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
    setLogoUrl(await resolveProfilePhotoUrl(supabase, path));
    setMsg("Organization logo uploaded — it will show on your GotREFS ID card.");
  }

  async function savePayoutMethod(payload: PayoutMethodPayload): Promise<boolean> {
    // Only store the method type, holder, and last 4 digits — never full account/routing numbers.
    const { error: updateErr } = await supabase.auth.updateUser({
      data: {
        payout_method: {
          method: payload.method,
          account_holder: payload.accountHolder,
          account_type: payload.accountType,
          last4: payload.last4,
          added_at: new Date().toISOString(),
        },
      },
    });
    if (updateErr) {
      setMsg(updateErr.message);
      return false;
    }
    setPayoutSet(true);
    return true;
  }

  function applyWizardDraft(draft: OrganizerWizardDraft) {
    if (draft.sport) setSport(draft.sport);
    setAdditionalSports(draft.additionalSports);
    setBio(draft.bio);
    setRateType(draft.rateType);
    setRatePerOfficial(draft.ratePerOfficial);
    setRateMin(draft.rateMin);
    setRateMax(draft.rateMax);
    setCity(draft.city);
    setState(draft.state);
    setZip(draft.zip);
    setNeeded(draft.officialsNeeded);
    const venueLabel =
      draft.venueType || draft.accessType
        ? `Venue: ${draft.venueType || "n/a"}; access: ${draft.accessType || "n/a"}; ${draft.street}${draft.unit ? ` ${draft.unit}` : ""}`
        : "";
    if (venueLabel) setNotes(venueLabel);
    setBrandHexPrimary(draft.brandHexPrimary ?? "");
    setBrandHexSecondary(draft.brandHexSecondary ?? "");
  }

  async function saveWizardProfile(draft: OrganizerWizardDraft): Promise<boolean> {
    applyWizardDraft(draft);
    setSavingProfile(true);
    setMsg(null);
    try {
      const rateNum = draft.ratePerOfficial === "" ? null : Number(draft.ratePerOfficial);
      const minNum = draft.rateMin === "" ? null : Number(draft.rateMin);
      const maxNum = draft.rateMax === "" ? null : Number(draft.rateMax);
      const res = await fetch("/api/organizer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: draft.bio,
          primary_sport: draft.sport,
          additional_sports: draft.additionalSports,
          rate_per_official:
            draft.rateType === "range" && Number.isFinite(minNum as number)
              ? minNum
              : Number.isFinite(rateNum as number)
                ? rateNum
                : null,
          rate_type: draft.rateType,
          rate_min: draft.rateType === "range" && Number.isFinite(minNum as number) ? minNum : null,
          rate_max: draft.rateType === "range" && Number.isFinite(maxNum as number) ? maxNum : null,
          brand_hex_primary: draft.brandHexPrimary.trim() || null,
          brand_hex_secondary: draft.brandHexSecondary.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      const tolerated = !res.ok && isMissingOrganizerRateColumn({ message: json.error });
      if (!res.ok && !tolerated) {
        setMsg(json.error || "Could not save profile.");
        return false;
      }
      setMsg("Progress saved.");
      await load();
      return true;
    } catch {
      setMsg("Could not reach the server.");
      return false;
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadEventsList(file: File) {
    if (!file) return;
    setMsg(null);
    setEventMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await ensureOrganizerProfile(user.id);

    const path = `${user.id}/events_list_${crypto.randomUUID()}_${sanitizeFilename(file.name)}`;
    const { error: upErr } = await supabase.storage.from("verification_documents").upload(path, file);
    if (upErr) {
      setMsg(upErr.message);
      setEventMsg(upErr.message);
      return;
    }
    await supabase.from("organizer_profiles").update({ events_list_path: path }).eq("member_id", user.id);
    setEventsListPath(path);

    const isCsv =
      file.name.toLowerCase().endsWith(".csv") ||
      file.type.includes("csv") ||
      file.type.includes("text");

    if (!isCsv) {
      const saved =
        "Events list file saved. For review-and-publish, upload a .csv with columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer";
      setMsg(saved);
      setEventMsg(saved);
      await load();
      return;
    }

    const text = await file.text();
    const parsed = parseEventsCsv(text);
    setCsvParseErrors(parsed.errors);
    if (parsed.events.length === 0) {
      const fail =
        parsed.errors[0] ||
        "Could not read any games from that CSV. Check dates and column headers, then try again.";
      setMsg(fail);
      setEventMsg(fail);
      return;
    }

    setCsvImportRows(parsed.events);
    setMsg(
      `Loaded ${parsed.events.length} game${parsed.events.length === 1 ? "" : "s"} from CSV. Review each one, fix dates if needed, then publish one by one.`
    );
    setEventMsg(null);
  }

  async function publishCsvImportRow(row: ParsedCsvEvent): Promise<boolean> {
    setCsvPublishing(true);
    try {
      await fetch("/api/auth/sync-member", { method: "POST" });
      const body = csvDraftToPublishBody(row);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setMsg(j.error || "Could not publish this game.");
        setEventMsg(j.error || "Could not publish this game.");
        return false;
      }
      setJustPublished((current) => [
        {
          id: j.id,
          title: body.title,
          whenLabel: formatEventDateTime(body.starts_at),
          whereLabel: formatEventLocation(body.city, body.state, body.zip_code) || `ZIP ${body.zip_code}`,
        },
        ...current,
      ]);
      setMsg(`Published “${body.title}”. Continue reviewing the rest, or close when finished.`);
      setEventMsg(null);
      await load();
      return true;
    } catch {
      setMsg("Could not reach the server.");
      return false;
    } finally {
      setCsvPublishing(false);
    }
  }

  async function createEventFromWizard(draft: OrganizerWizardDraft): Promise<boolean> {
    setMsg(null);
    const startVal = draft.eventStart.trim();
    const zipVal = draft.zip.trim();
    if (!startVal) {
      setMsg("Pick when your event starts.");
      return false;
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipVal)) {
      setMsg("Enter a valid ZIP code so refs can match by area.");
      return false;
    }
    try {
      await fetch("/api/auth/sync-member", { method: "POST" });
      const rateNum = draft.ratePerOfficial === "" ? null : Number(draft.ratePerOfficial);
      const publishedTitle = draft.eventTitle.trim() || `${draft.sport || "Game"} event`;
      const contactParts: string[] = [];
      const levelLabel = gameLevelLabel(draft.gameLevel);
      if (levelLabel) contactParts.push(`Level: ${levelLabel}`);
      if (draft.clubName.trim()) contactParts.push(`Club: ${draft.clubName.trim()}`);
      // No personal names, emails, or phones on ref-facing event notes.
      if (draft.refInstructions.trim()) contactParts.push(`Notes for refs: ${draft.refInstructions.trim()}`);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishedTitle,
          sport: draft.sport || "Basketball",
          starts_at: startVal,
          ends_at: draft.eventEnd.trim() || startVal,
          city: draft.city.trim() || null,
          state: draft.state.trim() || null,
          zip_code: zipVal,
          venue_street: draft.street.trim() || null,
          venue_unit: draft.unit.trim() || null,
          venue_lat: draft.lat,
          venue_lng: draft.lng,
          officials_needed: draft.officialsNeeded,
          pay_offer: Number.isFinite(rateNum as number) ? rateNum : null,
          pay_type: "exact",
          pay_min: null,
          pay_max: null,
          notes: contactParts.join(" · ") || null,
          boosts: [],
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean; id?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not publish event.");
        return false;
      }
      return true;
    } catch {
      setMsg("Could not reach the server. Refresh and try again.");
      return false;
    }
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
    if (!/^\d{5}(-\d{4})?$/.test(zipVal)) {
      const text = "Enter a valid ZIP code so refs can match by area.";
      setEventMsg(text);
      setMsg(text);
      return;
    }
    setPublishing(true);
    try {
      await fetch("/api/auth/sync-member", { method: "POST" });
      const payNum = pay === "" ? null : Number(pay);
      const payMinNum = payMin === "" ? null : Number(payMin);
      const payMaxNum = payMax === "" ? null : Number(payMax);
      const publishedTitle = title.trim() || "Event";
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishedTitle,
          sport: eventSport,
          starts_at: startVal,
          ends_at: endVal || startVal,
          city: city.trim() || null,
          state: state.trim() || null,
          zip_code: zipVal,
          officials_needed: needed,
          pay_offer:
            payType === "range" && Number.isFinite(payMinNum as number)
              ? payMinNum
              : Number.isFinite(payNum as number)
                ? payNum
                : null,
          pay_type: payType,
          pay_min: payType === "range" && Number.isFinite(payMinNum as number) ? payMinNum : null,
          pay_max: payType === "range" && Number.isFinite(payMaxNum as number) ? payMaxNum : null,
          notes: notes || null,
        }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean; id?: string };
      if (!res.ok) {
        const text = json.error || "Could not publish event.";
        setEventMsg(text);
        setMsg(text);
        return;
      }

      const whereLabel = formatEventLocation(city.trim() || null, state.trim() || null, zipVal) || `ZIP ${zipVal}`;
      setJustPublished((current) => [
        {
          id: json.id,
          title: publishedTitle,
          whenLabel: formatEventDateTime(startVal),
          whereLabel,
        },
        ...current,
      ]);

      // Sticky venue/pay defaults; clear timing + title for the next game.
      const nextStart = bumpDatetimeLocal(endVal || startVal, 2) || bumpDatetimeLocal(startVal, 2);
      const nextEnd = nextStart ? bumpDatetimeLocal(nextStart, 2) : "";
      setTitle("");
      setNotes("");
      setStarts(nextStart);
      setEnds(nextEnd);
      setEventMsg(null);
      setMsg("Event published. Add another or tap Done.");
      setPublishing(false);
      await load();
    } catch {
      const text = "Could not reach the server. Refresh and try again.";
      setEventMsg(text);
      setMsg(text);
      setPublishing(false);
    }
  }

  async function sendOfferFromRequest(applicant: ApplicantRow) {
    const ok = await decideApplicant(applicant.id, "accept");
    if (ok) setMsg("Ref approved — they’ll see the full address under Upcoming games.");
  }

  async function declineApplicant(applicant: ApplicantRow) {
    await decideApplicant(applicant.id, "decline");
  }

  async function sendOffer(refMemberId = offerRef, eventId = offerEvent) {
    if (!requireOrganizerOnboarding()) return false;
    if (!eventId || !refMemberId) {
      setMsg("Pick an event and a referee before sending the request.");
      return false;
    }
    if (!events.some((e) => e.id === eventId)) {
      setMsg("You can only hire refs for your own events.");
      return false;
    }
    if (offerSending) return false;
    setOfferSending(true);
    try {
      const event = events.find((e) => e.id === eventId);
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          refMemberId,
          offeredPay: event?.pay_offer ?? null,
          message: "We'd love for you to ref for our upcoming event.",
        }),
      });
      const j = (await res.json()) as { error?: string };
      setMsg(
        res.ok
          ? "Request sent. The ref gets a dashboard invite and email to accept or decline."
          : j.error || "Could not send request."
      );
      if (res.ok) {
        setOfferRef("");
        // Keep the selected event so organizers can request additional refs for the same game.
      }
      await load();
      return res.ok;
    } catch {
      setMsg("Could not reach the server. Refresh and try again.");
      return false;
    } finally {
      setOfferSending(false);
    }
  }

  async function startStripeCheckout(eventId: string) {
    setMsg(null);
    setCheckoutEventId(eventId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setMsg(json.error || "Could not start Stripe checkout.");
        return;
      }
      window.location.assign(json.url);
    } catch {
      setMsg("Could not reach Stripe checkout. Refresh and try again.");
    } finally {
      setCheckoutEventId(null);
    }
  }

  async function submitRating(
    offer: OrganizerOfferRow,
    score: number | null,
    skipped = false,
    comment = ""
  ) {
    const key = ratingKey(offer.event_id, offer.ref_member_id);
    setRatingSubmitting(key);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: offer.event_id,
          refMemberId: offer.ref_member_id,
          score,
          skipped,
          comment: skipped ? null : comment,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        average?: number | null;
        count?: number;
      };
      if (!res.ok) {
        const detail = json.error || "Could not save rating.";
        setMsg(detail);
        throw new Error(detail);
      }
      setSubmittedRatings((current) => [
        ...current.filter((rating) => ratingKey(rating.event_id, rating.ref_member_id) !== key),
        { event_id: offer.event_id, ref_member_id: offer.ref_member_id, score, skipped },
      ]);
      if (!skipped && typeof json.average === "number") {
        setRefs((current) =>
          current.map((ref) =>
            ref.id === offer.ref_member_id
              ? {
                  ...ref,
                  ratingAverage: json.average ?? ref.ratingAverage,
                  ratingCount: json.count ?? ref.ratingCount,
                }
              : ref
          )
        );
      }
      setLeaveReviewOffer(null);
      setMsg(
        skipped
          ? "Rating skipped for this completed game."
          : "Review published. Their star average updates from every host review."
      );
      await load();
    } catch (err) {
      if (!(err instanceof Error && err.message)) setMsg("Could not reach the server.");
      throw err instanceof Error ? err : new Error("Could not save rating.");
    } finally {
      setRatingSubmitting(null);
    }
  }

  const needsSetup = !isOrganizerProfileComplete();
  const forceWizard = searchParams.get("setup") === "1";

  // Open the Airbnb wizard as soon as ?setup=1 / Post event is requested —
  // don't wait on the full dashboard load (directory can take seconds).
  if (forceWizard || wizardOpen || payoutWizardOpen) {
    const payoutOnly = payoutWizardOpen && !forceWizard && !wizardOpen;
    return (
      <OrganizerListingWizard
        organizationName={organizationName || displayName}
        saving={savingProfile}
        logoPath={logoPath}
        payoutOnly={payoutOnly}
        initialDraft={{
          sport,
          additionalSports,
          bio,
          rateType,
          ratePerOfficial,
          rateMin,
          rateMax,
          city,
          state,
          zip,
          officialsNeeded: needed,
          clubName: organizationName,
          contactName: displayName,
          contactEmail: accountEmail,
          brandHexPrimary,
          brandHexSecondary,
        }}
        onSaveProfile={saveWizardProfile}
        onUploadLogo={uploadLogoFile}
        onSavePayoutMethod={savePayoutMethod}
        onCreateEvent={createEventFromWizard}
        onSaveAndExit={(draft) => {
          applyWizardDraft(draft);
          if (forceWizard) {
            window.history.replaceState({}, "", "/dashboard/organizer");
          }
          setWizardOpen(false);
          setPayoutWizardOpen(false);
          setMsg("Progress saved. Pick up where you left off anytime.");
          void load();
        }}
        onComplete={(draft) => {
          if (payoutOnly) {
            setPayoutWizardOpen(false);
            setMsg(payoutSet ? "Payout method added." : null);
            void load();
            return;
          }
          if (forceWizard) {
            applyWizardDraft(draft);
            setMsg("Setup preview finished. Remove ?setup=1 from the URL to return to your dashboard.");
            window.history.replaceState({}, "", "/dashboard/organizer");
            void load();
            return;
          }
          setWizardOpen(false);
          applyWizardDraft(draft);
          setMsg("Your event is posted. Staff it from Listings.");
          void load();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-[2rem] bg-slate-100" />
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <div className="h-12 animate-pulse rounded-full bg-slate-100" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const setupActions: { step: OrganizerSetupStep; label: string; done: boolean }[] = [
    { step: "sport", label: "Primary sport", done: Boolean(sport.trim()) },
    { step: "pay", label: "Typical pay per official", done: hasOrganizerPay() },
    { step: "bio", label: "About your org", done: Boolean(bio.trim()) },
    { step: "events", label: "Add upcoming events", done: events.length > 0 || Boolean(eventsListPath) },
    { step: "identity", label: "Organization logo & brand colors", done: Boolean(logoPath) },
  ];
  const currentSetup = setupActions.find((item) => item.step === setupStep) ?? setupActions[0];
  const staffingEvent = events.find((event) => event.id === staffingEventId) ?? null;
  const manageMonthLabel = manageCalendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const manageEventsByDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const eventDate = new Date(event.starts_at);
    const key = dayKey(eventDate);
    manageEventsByDay.set(key, [...(manageEventsByDay.get(key) || []), event]);
  }
  const manageCalendarWeeks = buildMonthWeeks(manageCalendarCursor);
  const respondedSentOffers = sentOffers.filter((offer) => offer.status === "accepted" || offer.status === "declined");
  const acceptedOffersByEvent = sentOffers.reduce<Record<string, number>>((acc, offer) => {
    if (offer.status === "accepted") acc[offer.event_id] = (acc[offer.event_id] || 0) + 1;
    return acc;
  }, {});
  const acceptedOfferPaymentsByEvent = sentOffers.reduce<
    Record<string, { refSubtotalCents: number; platformFeeCents: number; totalCents: number; boostCents: number }>
  >((acc, offer) => {
    if (offer.status !== "accepted") return acc;
    const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
    const refSubtotalCents = dollarsToCents(offer.offered_pay ?? event?.pay_offer);
    const boostCents =
      offer.base_pay != null && offer.offered_pay != null
        ? Math.max(0, dollarsToCents(offer.offered_pay) - dollarsToCents(offer.base_pay))
        : 0;
    const current =
      acc[offer.event_id] ?? { refSubtotalCents: 0, platformFeeCents: 0, totalCents: 0, boostCents: 0 };
    const nextRefSubtotalCents = current.refSubtotalCents + refSubtotalCents;
    const nextPlatformFeeCents = calcPlatformFeeCents(nextRefSubtotalCents);
    acc[offer.event_id] = {
      refSubtotalCents: nextRefSubtotalCents,
      platformFeeCents: nextPlatformFeeCents,
      totalCents: nextRefSubtotalCents + nextPlatformFeeCents,
      boostCents: current.boostCents + boostCents,
    };
    return acc;
  }, {});
  const submittedRatingKeys = new Set(
    submittedRatings.map((rating) => ratingKey(rating.event_id, rating.ref_member_id))
  );
  const completedUnratedOffers = sentOffers.filter((offer) => {
    const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
    if (offer.status !== "accepted" || !event?.ends_at || !ratingCutoffIso) return false;
    return (
      event.ends_at <= ratingCutoffIso &&
      !submittedRatingKeys.has(ratingKey(offer.event_id, offer.ref_member_id))
    );
  });

  const acceptedBookings = sentOffers
    .filter((offer) => offer.status === "accepted")
    .map((offer) => {
      const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
      const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
      return {
        id: offer.id,
        eventId: offer.event_id,
        officialId: refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`,
        eventTitle: event?.title ?? "Your event",
        sport: event?.sport ?? "Game",
        startsAt: event?.starts_at ?? null,
        pay: offer.offered_pay ?? event?.pay_offer ?? null,
        boostPercent: offer.boost_percent ?? 0,
      };
    })
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  const todayBookings = acceptedBookings.filter((booking) => {
    if (!booking.startsAt) return false;
    return sameDay(new Date(booking.startsAt), new Date());
  });
  const upcomingBookings = acceptedBookings.filter((booking) => {
    if (!booking.startsAt) return false;
    return new Date(booking.startsAt).getTime() >= Date.now();
  });
  const visibleBookings = todayFilter === "today" ? todayBookings : upcomingBookings;
  const pendingOffersByEvent = sentOffers.reduce<Record<string, number>>((acc, offer) => {
    if (offer.status !== "accepted" && offer.status !== "declined") {
      acc[offer.event_id] = (acc[offer.event_id] || 0) + 1;
    }
    return acc;
  }, {});
  const messagesCount = signupRequests.length + respondedSentOffers.length;

  return (
    <div className="flex flex-col gap-8">
      {setupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setSetupModalOpen(false)}
        >
          <section
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Organizer setup</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Step {ORGANIZER_SETUP_ORDER.indexOf(setupStep) + 1} of {ORGANIZER_SETUP_ORDER.length}: {currentSetup.label}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add an event or update your organizer details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSetupModalOpen(false)}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2">
          {setupActions.map((action, index) => {
            const active = action.step === setupStep;
            const complete = action.done;
            return (
              <button
                key={action.step}
                type="button"
                onClick={() => setSetupStep(action.step)}
                className="group flex min-w-0 flex-1 items-center gap-2"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all duration-200 ${
                    active
                      ? "bg-[var(--navy)] text-white"
                      : complete
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span className={`hidden h-px flex-1 sm:block ${active || complete ? "bg-[var(--navy)]/30" : "bg-slate-200"}`} />
              </button>
            );
          })}
        </div>

        {setupStep === "sport" && (
          <div className="mt-5">
            <SportsFields
              primarySport={sport}
              additionalSports={additionalSports}
              onPrimaryChange={setSport}
              onAdditionalChange={setAdditionalSports}
            />
            <button
              type="button"
              disabled={savingProfile}
              onClick={() => void saveProfileAndAdvance("sport")}
              className="mt-5 w-full rounded-xl bg-[var(--blue)] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--navy)] disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingProfile ? "Saving…" : "Looks Good, Next Step →"}
            </button>
          </div>
        )}

        {setupStep === "pay" && (
          <div className="mt-5">
            <label className="flex flex-col gap-1 text-sm">
              Base pay per official
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-semibold text-neutral-900">$</span>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded border border-[var(--border)] px-3 py-2 text-lg font-semibold"
                    value={ratePerOfficial}
                    onChange={(e) => {
                      setRateType("exact");
                      setRateMin("");
                      setRateMax("");
                      setRatePerOfficial(e.target.value);
                    }}
                    placeholder="e.g. 45"
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  This is what each official earns for the game.
                </p>
              </div>
            </label>
            <button
              type="button"
              disabled={savingProfile}
              onClick={() => void saveProfileAndAdvance("pay")}
              className="mt-5 w-full rounded-xl bg-[var(--blue)] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--navy)] disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingProfile ? "Saving…" : "Looks Good, Next Step →"}
            </button>
          </div>
        )}

        {setupStep === "bio" && (
          <div className="mt-5">
            <label className="flex flex-col gap-1 text-sm">
              About your organization
              <textarea
                className="min-h-[110px] rounded border border-[var(--border)] px-3 py-2"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell refs about your league, school, tournaments, sports, and expectations."
              />
            </label>
            <button
              type="button"
              disabled={savingProfile}
              onClick={() => void saveProfileAndAdvance("bio")}
              className="mt-5 w-full rounded-xl bg-[var(--blue)] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--navy)] disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingProfile ? "Saving…" : "Looks Good, Next Step →"}
            </button>
          </div>
        )}

        {setupStep === "events" && (
          <div className="mt-5">
            <OrganizerEventComposer
              values={{
                title,
                sport: eventSport,
                starts,
                ends,
                city,
                state,
                zip,
                needed,
                pay,
                payType,
                payMin,
                payMax,
                notes,
              }}
              onChange={(patch) => {
                if (patch.title !== undefined) setTitle(patch.title);
                if (patch.sport !== undefined) setEventSport(patch.sport);
                if (patch.starts !== undefined) setStarts(patch.starts);
                if (patch.ends !== undefined) setEnds(patch.ends);
                if (patch.city !== undefined) setCity(patch.city);
                if (patch.state !== undefined) setState(patch.state);
                if (patch.zip !== undefined) setZip(patch.zip);
                if (patch.needed !== undefined) setNeeded(patch.needed);
                if (patch.pay !== undefined) setPay(patch.pay);
                if (patch.payType !== undefined) setPayType(patch.payType);
                if (patch.payMin !== undefined) setPayMin(patch.payMin);
                if (patch.payMax !== undefined) setPayMax(patch.payMax);
                if (patch.notes !== undefined) setNotes(patch.notes);
              }}
              onPublish={() => void createEvent()}
              onDone={finishEventsStep}
              publishing={publishing}
              justPublished={justPublished}
              error={eventMsg}
              onClearError={clearEventFeedback}
              onImportCsv={(file) => void uploadEventsList(file)}
              eventsListSaved={Boolean(eventsListPath)}
            />
            {justPublished.length === 0 ? (
              <p className="mt-4 text-center text-sm text-neutral-500">
                Or{" "}
                <button
                  type="button"
                  onClick={() => setSetupModalOpen(false)}
                  className="font-semibold text-neutral-800 underline underline-offset-2"
                >
                  close without publishing
                </button>
              </p>
            ) : null}
          </div>
        )}

        {setupStep === "identity" && (
          <div className="mt-5 space-y-5">
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-lg font-semibold text-neutral-900">Organization logo</p>
                <p className="mt-1 text-sm text-neutral-500">
                  PNG, JPG, SVG, or WEBP — this photo appears on your GotREFS ID card
                </p>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.svg,.webp"
                  className="mt-4 text-sm"
                  onChange={(e) => void uploadLogo(e)}
                />
                {logoPath && <p className="mt-2 text-sm text-emerald-700">Logo on file.</p>}
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-lg font-semibold text-neutral-900">Brand Hex Colors: Optional</p>
                <p className="mt-1 text-sm text-neutral-500">Used on your organizer ID card.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-neutral-500">Primary</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Primary brand color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(brandHexPrimary) ? brandHexPrimary : "#0D1B2A"}
                        onChange={(e) => setBrandHexPrimary(e.target.value.toUpperCase())}
                        className="h-10 w-12 cursor-pointer rounded border border-neutral-300 bg-white p-1"
                      />
                      <input
                        type="text"
                        placeholder="#0D1B2A"
                        value={brandHexPrimary}
                        onChange={(e) => setBrandHexPrimary(e.target.value.trim())}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs text-neutral-500">Secondary</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Secondary brand color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(brandHexSecondary) ? brandHexSecondary : "#7F1D1D"}
                        onChange={(e) => setBrandHexSecondary(e.target.value.toUpperCase())}
                        className="h-10 w-12 cursor-pointer rounded border border-neutral-300 bg-white p-1"
                      />
                      <input
                        type="text"
                        placeholder="#7F1D1D"
                        value={brandHexSecondary}
                        onChange={(e) => setBrandHexSecondary(e.target.value.trim())}
                        className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={!logoPath}
              onClick={() => {
                void (async () => {
                  const userId = (await supabase.auth.getUser()).data.user?.id;
                  if (userId) {
                    await supabase
                      .from("organizer_profiles")
                      .update({
                        brand_hex_primary: brandHexPrimary.trim() || null,
                        brand_hex_secondary: brandHexSecondary.trim() || null,
                      })
                      .eq("member_id", userId);
                  }
                  finishOrganizerSetup();
                })();
              }}
              className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              Finish setup
            </button>
          </div>
        )}

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
        </div>
      )}

      {msg && (
        <div className="fixed right-4 top-20 z-[70] max-w-sm rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-xl">
          {msg}
        </div>
      )}

      {/* Airbnb-host-style top nav */}
      <div className="flex flex-wrap items-center justify-center gap-1 border-b border-neutral-200 pb-3">
        {(
          [
            { id: "today", label: "Today" },
            { id: "calendar", label: "Calendar" },
            { id: "listings", label: "Listings" },
            { id: "messages", label: "Messages" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative rounded-full px-4 py-2 text-sm transition ${
              activeTab === tab.id
                ? "font-semibold text-neutral-900 underline decoration-2 underline-offset-[14px]"
                : "font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
            }`}
          >
            {tab.label}
            {tab.id === "messages" && messagesCount > 0 && (
              <span className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--red)]" />
            )}
          </button>
        ))}
      </div>

      {/* Action required cards — what's left to complete */}
      {(needsSetup || !payoutSet) && (
        <div className="flex flex-wrap justify-center gap-3">
          {needsSetup && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className={`flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 ${marketplaceCardShadow}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-2xl" aria-hidden>
                📋
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">Add registration details</span>
                <span className="mt-0.5 block text-xs text-neutral-500">Required to publish</span>
              </span>
            </button>
          )}
          {!payoutSet && (
            <button
              type="button"
              onClick={() => setPayoutWizardOpen(true)}
              className={`flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 ${marketplaceCardShadow}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-2xl" aria-hidden>
                🪙
              </span>
              <span>
                <span className="block text-sm font-semibold text-neutral-900">Add a payout method</span>
                <span className="mt-0.5 block text-xs text-neutral-500">Required to get paid</span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Today tab ── */}
      {activeTab === "today" && (
        <>
          <div className="mx-auto w-full max-w-lg">
            <OrganizerIdCard
              organizationName={organizationName || "Organization"}
              contactName={displayName}
              email={accountEmail}
              primarySport={sport || undefined}
              additionalSports={additionalSports}
              typicalPay={
                rateType === "range"
                  ? [rateMin, rateMax].filter(Boolean).join("–") || undefined
                  : ratePerOfficial || undefined
              }
              bio={bio || undefined}
              eventsCount={events.length}
              logoUploaded={Boolean(logoPath)}
              logoUrl={logoUrl}
              brandHexPrimary={brandHexPrimary || null}
              brandHexSecondary={brandHexSecondary || null}
              onUploadLogo={(file) => void uploadLogoFile(file)}
            />
          </div>

          <div className="flex justify-center">
            <div className="flex gap-2">
              {(["today", "upcoming"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTodayFilter(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                    todayFilter === filter
                      ? "bg-neutral-800 text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {visibleBookings.length === 0 ? (
            <div className="mx-auto max-w-md py-10 text-center">
              <p className="text-7xl" aria-hidden>
                📖
              </p>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-900">
                You don&apos;t have any bookings
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                {needsSetup
                  ? "To get refs booked, you'll need to complete and publish your listing."
                  : "Post an event and invite refs to get your first booking."}
              </p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-6 rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
              >
                {needsSetup ? "Complete your listing" : "Post an event"}
              </button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-2xl space-y-3">
              {visibleBookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => openStaffingForEvent(booking.eventId)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 ${marketplaceCardShadow}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      Official {booking.officialId} · {booking.eventTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {booking.sport}
                      {booking.startsAt ? ` · ${formatEventDateTime(booking.startsAt)}` : ""}
                      {booking.pay != null ? ` · $${booking.pay}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {booking.boostPercent > 0 && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        +{booking.boostPercent}% boost
                      </span>
                    )}
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Confirmed
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {(signupRequests.length > 0 || respondedSentOffers.length > 0) && (
            <section ref={notificationsRef} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-neutral-900">Inbox</h2>
              <div className="mt-3 space-y-2">
                {signupRequests.slice(0, 3).map((sr) => (
                  <button
                    key={sr.id}
                    type="button"
                    onClick={() => applicantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="block w-full rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                  >
                    Ref {sr.gotrefsId} requested {sr.eventTitle}
                  </button>
                ))}
                {respondedSentOffers.slice(0, 3).map((offer) => {
                  const ev = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
                  const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
                  const officialId = refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`;
                  return (
                    <p key={offer.id} className="rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                      Official {officialId} {offer.status} {ev?.title ?? "your event"}
                    </p>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "calendar" && (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Calendar</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Your games by date. Click a game to hire refs for that event only.
            </p>
          </div>
        </div>
        <div className="mt-5">
            <div className="rounded-2xl border border-[#F1F5F9] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
                  onClick={() =>
                    setManageCalendarCursor(
                      new Date(manageCalendarCursor.getFullYear(), manageCalendarCursor.getMonth() - 1, 1)
                    )
                  }
                >
                  ←
                </button>
                <p className="font-black text-[var(--navy)]">{manageMonthLabel}</p>
                <button
                  type="button"
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm transition-all duration-200 hover:bg-[var(--grey-light)]"
                  onClick={() =>
                    setManageCalendarCursor(
                      new Date(manageCalendarCursor.getFullYear(), manageCalendarCursor.getMonth() + 1, 1)
                    )
                  }
                >
                  →
                </button>
              </div>
              <div className="mt-4 grid grid-cols-7 border-y border-[#F1F5F9] text-center text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-[#F1F5F9]">
                {manageCalendarWeeks.flat().map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} className="min-h-28 border-b border-r border-[#F1F5F9]" />;
                  const key = dayKey(day);
                  const dayEvents = manageEventsByDay.get(key) || [];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const selected = selectedManageDate && sameDay(day, selectedManageDate);
                  return (
                    <div
                      key={key}
                      className={`min-h-28 border-b border-r border-[#F1F5F9] p-1.5 transition-all duration-200 ${
                        isWeekend ? "bg-slate-50/70" : "bg-white"
                      } ${selected ? "ring-2 ring-inset ring-[var(--blue)]/40" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => (dayEvents.length ? setSelectedManageDate(day) : prefillEventDate(day))}
                        className="mb-1 rounded-full px-2 py-0.5 text-xs font-bold text-[var(--slate)] transition-all duration-200 hover:bg-[var(--grey-light)]"
                      >
                        {day.getDate()}
                      </button>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const hiredCount = acceptedOffersByEvent[event.id] || 0;
                          const filled = hiredCount >= event.officials_needed;
                          return (
                            <div key={event.id} className="group relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedManageDate(day);
                                  browseRefsForEvent(event.id);
                                }}
                                className={`block w-full truncate rounded-full px-2 py-1 text-left text-[10px] font-black transition-all duration-200 ${
                                  filled
                                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                {hiredCount}/{event.officials_needed} Refs · {event.sport}
                              </button>
                              <div className="pointer-events-none absolute left-0 top-7 z-20 hidden w-56 rounded-xl border border-[var(--border)] bg-white p-3 text-left text-xs shadow-xl group-hover:block">
                                <p className="font-black text-[var(--navy)]">{event.title}</p>
                                <p className="mt-1 text-[var(--muted)]">{event.sport} · {formatEventDateTime(event.starts_at)}</p>
                                <p className="mt-1 font-bold text-amber-700">
                                  Missing {Math.max(event.officials_needed - hiredCount, 0)} slot(s)
                                </p>
                                <p className="mt-2 font-bold text-[var(--blue)]">Click to staff this game.</p>
                              </div>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <p className="px-2 text-[10px] font-semibold text-[var(--muted)]">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Click a blank date to post a new event. Click one of your games to hire refs for that listing only.
              </p>
            </div>
        </div>
      </section>
      )}

      {/* ── Listings tab: only this organizer's events ── */}
      {activeTab === "listings" && (
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Your listings</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Games you posted for {organizationName || "your organization"}. Open a listing to review applicants or request refs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadEventsList(file);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="rounded-full bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--red-dark)]"
            >
              + Post event
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <h3 className="text-lg font-semibold text-neutral-900">No listings yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Post your first game for {organizationName || "your organization"}. Refs will request to work it from Find Games.
            </p>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--red)] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-[var(--red-dark)]"
            >
              <span className="text-lg leading-none">+</span>
              Post an event
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((e) => {
              const loc = formatEventLocation(e.city, e.state, e.zip_code);
              const applicantCount = signupRequests.filter((request) => request.eventId === e.id).length;
              const hiredCount = acceptedOffersByEvent[e.id] || 0;
              const pendingCount = pendingOffersByEvent[e.id] || 0;
              const payment = acceptedOfferPaymentsByEvent[e.id];
              const filled = hiredCount >= e.officials_needed;
              const payLabel = formatPayOffer(e.pay_offer);
              const status = filled
                ? { className: "bg-emerald-50 text-emerald-800", label: "Fully staffed" }
                : applicantCount > 0
                  ? { className: "bg-amber-50 text-amber-900", label: `${applicantCount} applicant${applicantCount === 1 ? "" : "s"}` }
                  : pendingCount > 0
                    ? { className: "bg-sky-50 text-sky-900", label: "Invite pending" }
                    : { className: "bg-neutral-100 text-neutral-700", label: "Needs refs" };
              const visual = sportListingVisual(e.sport);
              return (
                <article
                  key={e.id}
                  className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => openStaffingForEvent(e.id)}
                      className="flex min-w-0 flex-1 items-start gap-4 text-left"
                    >
                      <span
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl ${visual.gradient}`}
                        aria-hidden
                      >
                        {visual.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-lg font-semibold text-neutral-900">{e.title}</span>
                        <span className="mt-1 block text-sm text-neutral-500">
                          {e.sport} · {formatEventDateTime(e.starts_at)}
                        </span>
                        <span className="mt-1 block text-sm text-neutral-500">
                          {loc || `ZIP ${e.zip_code}`}
                          {payLabel ? ` · ${payLabel}` : ""}
                        </span>
                        {payment && payment.totalCents > 0 ? (
                          <span className="mt-1 block text-xs font-semibold text-neutral-500">
                            Checkout total {formatCents(payment.totalCents)} (includes{" "}
                            {PLATFORM_FEE_PERCENT_LABEL} GotREFS fee)
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="rounded-full bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                        {hiredCount}/{e.officials_needed} hired
                      </span>
                      {payment && payment.totalCents > 0 ? (
                        <button
                          type="button"
                          disabled={checkoutEventId === e.id}
                          onClick={() => void startStripeCheckout(e.id)}
                          className="rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--blue)] disabled:opacity-60"
                        >
                          {checkoutEventId === e.id ? "Opening Stripe..." : `Pay ${formatCents(payment.totalCents)}`}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openStaffingForEvent(e.id)}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                      >
                        {applicantCount > 0 ? "Review applicants" : "Staff this game"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}

      {activeTab === "today" && completedUnratedOffers.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Completed games</p>
              <h2 className="mt-1 font-display text-xl font-bold text-[var(--navy)]">Rate your refs</h2>
              <p className="mt-1 text-sm text-amber-900">
                After a game ends, leave a star rating and public review — the same way Airbnb asks hosts to review guests.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">
              {completedUnratedOffers.length} pending
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {completedUnratedOffers.slice(0, 6).map((offer) => {
              const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
              const key = ratingKey(offer.event_id, offer.ref_member_id);
              const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
              const officialId = refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`;
              return (
                <article
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-4"
                >
                  <div>
                    <p className="font-black text-[var(--navy)]">{event?.title ?? "Completed game"}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                      Official {officialId} ·{" "}
                      {event?.starts_at ? formatEventDateTime(event.starts_at) : "Game complete"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeaveReviewOffer(offer)}
                    className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-neutral-800"
                  >
                    Leave a review
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {leaveReviewOffer && (() => {
        const event = Array.isArray(leaveReviewOffer.scheduled_events)
          ? leaveReviewOffer.scheduled_events[0]
          : leaveReviewOffer.scheduled_events;
        const refMeta = refs.find((ref) => ref.id === leaveReviewOffer.ref_member_id);
        const officialId =
          refMeta?.gotrefsId ?? `GR-${leaveReviewOffer.ref_member_id.slice(0, 8).toUpperCase()}`;
        const key = ratingKey(leaveReviewOffer.event_id, leaveReviewOffer.ref_member_id);
        return (
          <LeaveReviewModal
            open
            onClose={() => setLeaveReviewOffer(null)}
            subjectLabel={`Official ${officialId}`}
            eventTitle={event?.title ?? "Completed game"}
            eventWhen={event?.starts_at ? formatEventDateTime(event.starts_at) : undefined}
            submitting={ratingSubmitting === key}
            onSubmit={async ({ score, comment }) => {
              await submitRating(leaveReviewOffer, score, false, comment);
            }}
            onSkip={async () => {
              await submitRating(leaveReviewOffer, null, true);
            }}
          />
        );
      })()}

      {activeTab === "today" && signupRequests.length > 0 && (
        <section ref={applicantsRef} className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Requests</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Review each official like a host profile — photo, reviews, then accept or decline.
            </p>
          </div>
          <div className="space-y-5">
            {signupRequests.map((sr) => (
              <AirbnbAcceptProfile
                key={sr.id}
                photoUrls={acceptPhotosForSport(sr.primarySport || "Basketball", sr.avatarUrl)}
                photoAlt={`Official ${sr.gotrefsId}`}
                sportForVisual={sr.primarySport || "Basketball"}
                eyebrow="Ref application"
                title={`Ref ${sr.gotrefsId}`}
                subtitle={`Requested to work ${sr.eventTitle}`}
                refMemberId={sr.refMemberId}
                ratingAverage={sr.ratingAverage}
                ratingCount={sr.ratingCount}
                reviewsTitle="Reviews from hosts"
                reviews={sr.reviews.map((review) => ({
                  score: review.score,
                  comment: review.comment,
                  createdAt: review.createdAt,
                  authorLabel: "Host",
                }))}
                metaRows={[
                  sr.gotrefsId ? `GotREFS ID ${sr.gotrefsId}` : null,
                  sr.refRateLabel ? `Ref rate ${sr.refRateLabel}` : null,
                  sr.eventPayLabel ? `Your event pay ${sr.eventPayLabel}` : null,
                ].filter(Boolean) as string[]}
                primaryLabel="Review & decide"
                secondaryLabel="Deny"
                onPrimary={() =>
                  setReviewApplicant({
                    id: sr.id,
                    eventId: sr.eventId,
                    refMemberId: sr.refMemberId,
                    gotrefsId: sr.gotrefsId,
                    displayName: null,
                    primarySport: sr.primarySport,
                    additionalSports: sr.additionalSports,
                    certificationLevel: sr.certificationLevel,
                    avatarUrl: sr.avatarUrl,
                    eventTitle: sr.eventTitle,
                    eventPlace: sr.eventPlace,
                    eventWhen: sr.eventWhen,
                    eventPayLabel: sr.eventPayLabel,
                    refRateLabel: sr.refRateLabel,
                    ratingAverage: sr.ratingAverage,
                    ratingCount: sr.ratingCount,
                    reviews: sr.reviews,
                  })
                }
                onSecondary={() => void declineApplicant(sr)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Messages tab ── */}
      {activeTab === "messages" && (
        <section className="mx-auto w-full max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Messages</h2>
          <p className="mt-1 text-sm text-neutral-500">Requests and replies between you and refs.</p>
          <div className="mt-5 space-y-3">
            {signupRequests.map((sr) => (
              <button
                key={sr.id}
                type="button"
                onClick={() =>
                  setReviewApplicant({
                    id: sr.id,
                    eventId: sr.eventId,
                    refMemberId: sr.refMemberId,
                    gotrefsId: sr.gotrefsId,
                    displayName: null,
                    primarySport: sr.primarySport,
                    additionalSports: sr.additionalSports,
                    certificationLevel: sr.certificationLevel,
                    avatarUrl: sr.avatarUrl,
                    eventTitle: sr.eventTitle,
                    eventPlace: sr.eventPlace,
                    eventWhen: sr.eventWhen,
                    eventPayLabel: sr.eventPayLabel,
                    refRateLabel: sr.refRateLabel,
                    ratingAverage: sr.ratingAverage,
                    ratingCount: sr.ratingCount,
                    reviews: sr.reviews,
                  })
                }
                className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 ${marketplaceCardShadow}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                  {sr.gotrefsId.slice(-2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    Ref {sr.gotrefsId}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    Requested to work {sr.eventTitle} — tap to review
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                  Pending
                </span>
              </button>
            ))}
            {respondedSentOffers.map((offer) => {
              const ev = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
              const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
              const officialId = refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`;
              const accepted = offer.status === "accepted";
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => openStaffingForEvent(offer.event_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 ${marketplaceCardShadow}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">
                    {officialId.slice(-2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">
                      Official {officialId}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {accepted ? "Accepted" : "Declined"} {ev?.title ?? "your event"}
                      {accepted && offer.offered_pay != null ? ` · $${offer.offered_pay}` : ""}
                      {accepted && (offer.boost_percent ?? 0) > 0 ? ` (includes ${offer.boost_percent}% boost)` : ""}
                      {offer.message ? ` — “${offer.message}”` : ""}
                    </span>
                  </span>
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      accepted ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${accepted ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden />
                    {accepted ? "Confirmed" : "Declined"}
                  </span>
                </button>
              );
            })}
            {messagesCount === 0 && (
              <div className="py-14 text-center">
                <p className="text-6xl" aria-hidden>
                  💬
                </p>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900">No messages yet</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  When refs apply to your events or respond to invites, you&apos;ll see the conversation here.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
      {staffingEvent && (
        <EventMatchingView
          event={staffingEvent}
          refs={refs}
          hiredCount={acceptedOffersByEvent[staffingEvent.id] || 0}
          pendingRefIds={
            new Set(
              sentOffers
                .filter((offer) => offer.event_id === staffingEvent.id && offer.status === "pending")
                .map((offer) => offer.ref_member_id)
            )
          }
          excludeRefIds={
            new Set(
              sentOffers
                .filter((offer) => offer.event_id === staffingEvent.id && offer.status === "accepted")
                .map((offer) => offer.ref_member_id)
            )
          }
          onBackToListings={() => {
            setStaffingEventId(null);
            setActiveTab("listings");
          }}
          onRequestRef={async (refId) => Boolean(await sendOffer(refId, staffingEvent.id))}
        />
      )}

      {reviewApplicant && (
        <ApplicantReviewModal
          applicant={reviewApplicant}
          onClose={() => setReviewApplicant(null)}
          onDecide={(action) => decideApplicant(reviewApplicant.id, action)}
        />
      )}

      {csvImportRows && csvImportRows.length > 0 && (
        <CsvEventImportReview
          rows={csvImportRows}
          parseErrors={csvParseErrors}
          publishing={csvPublishing}
          onClose={() => {
            setCsvImportRows(null);
            setCsvParseErrors([]);
            void load();
          }}
          onPublishOne={async (row) => publishCsvImportRow(row)}
        />
      )}
    </div>
  );
}
