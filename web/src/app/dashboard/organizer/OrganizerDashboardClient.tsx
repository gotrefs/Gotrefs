"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";
import { EventStaffingPanel } from "@/components/marketplace/EventStaffingPanel";
import { AirbnbMarketplaceSearch } from "@/components/marketplace/AirbnbMarketplaceSearch";
import { StickyMarketplaceSearch } from "@/components/marketplace/StickyMarketplaceSearch";
import { RefListingCard } from "@/components/marketplace/RefListingCard";
import { SportsFields } from "@/components/SportsFields";
import { ALL_SPORTS, formatEventLocation, formatPayOffer } from "@/data/sports";
import { payRangesOverlap } from "@/lib/pay-range";

type RefReview = {
  score: number;
  comment: string | null;
  createdAt: string;
};

type DirectoryRef = {
  id: string;
  gotrefsId: string;
  displayName: string;
  primarySport: string;
  sportEmoji: string;
  ratePerGame: number | null;
  rateType?: "exact" | "range" | null;
  rateMin?: number | null;
  rateMax?: number | null;
  rateUnit?: "hour" | "game" | null;
  homeZip: string | null;
  availability: { start_at: string; end_at: string }[];
  maskedEmail: string;
  ratingAverage: number | null;
  ratingCount: number;
  reviews?: RefReview[];
};

function slotCoversEvent(
  slot: { start_at: string; end_at: string },
  event: { starts_at: string; ends_at: string }
) {
  const slotStart = new Date(slot.start_at).getTime();
  const slotEnd = new Date(slot.end_at).getTime();
  const eventStart = new Date(event.starts_at).getTime();
  const eventEnd = new Date(event.ends_at).getTime();
  return slotStart <= eventStart && slotEnd >= eventEnd;
}

function locationFits(refZip: string | null, eventZip: string) {
  // Until we have geocoding/radius data, use exact ZIP when a ref posts home ZIP.
  return !refZip || refZip === eventZip;
}

function formatEventDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPayRange(value: {
  pay_offer?: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
}) {
  if (value.pay_type === "range") {
    const min = value.pay_min ?? value.pay_offer;
    const max = value.pay_max;
    if (min != null && max != null) return `$${Number(min).toFixed(0)}-$${Number(max).toFixed(0)}`;
    if (min != null) return `$${Number(min).toFixed(0)}+`;
  }
  return formatPayOffer(value.pay_offer ?? null);
}

function formatRefRate(ref: DirectoryRef) {
  const unit = ref.rateUnit === "game" ? "game" : "hr";
  if (ref.rateType === "range") {
    const min = ref.rateMin ?? ref.ratePerGame;
    const max = ref.rateMax;
    if (min != null && max != null) return `$${Number(min).toFixed(0)}-$${Number(max).toFixed(0)}/${unit}`;
    if (min != null) return `$${Number(min).toFixed(0)}+/${unit}`;
  }
  return ref.ratePerGame != null ? `$${Number(ref.ratePerGame).toFixed(0)}/${unit}` : "Rate TBD";
}

function refPayInput(ref: DirectoryRef) {
  return {
    type: ref.rateType === "range" ? ("range" as const) : ("exact" as const),
    exact: ref.ratePerGame,
    min: ref.rateMin,
    max: ref.rateMax,
  };
}

function eventPayInput(event: EventRow) {
  return {
    type: event.pay_type === "range" ? ("range" as const) : ("exact" as const),
    exact: event.pay_offer,
    min: event.pay_min,
    max: event.pay_max,
  };
}

function refPriceFitsEvent(ref: DirectoryRef, event: EventRow) {
  return payRangesOverlap(refPayInput(ref), eventPayInput(event));
}

function renderStarScore(score: number) {
  const safe = Math.max(1, Math.min(5, Math.round(score)));
  return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

function isMissingPayRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["pay_type", "pay_min", "pay_max"].some((column) => message.includes(column));
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

function queryIncludes(...values: Array<string | number | null | undefined>) {
  return values
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase())
    .join(" ");
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
};

type ApplicantRow = {
  id: string;
  eventId: string;
  refMemberId: string;
  createdAt: string;
  gotrefsId: string;
  eventTitle: string;
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
  const searchParams = useSearchParams();
  const notificationsRef = useRef<HTMLElement | null>(null);
  const applicantsRef = useRef<HTMLElement | null>(null);
  const marketplaceRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<OrganizerSetupStep>("sport");
  const [setupModalOpen, setSetupModalOpen] = useState(false);
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
  const [payType, setPayType] = useState<"exact" | "range">("exact");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [notes, setNotes] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [magicSearch, setMagicSearch] = useState("");
  const [manageViewMode, setManageViewMode] = useState<"list" | "calendar">("list");
  const [manageCalendarCursor, setManageCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedManageDate, setSelectedManageDate] = useState<Date | null>(null);
  const [refs, setRefs] = useState<DirectoryRef[]>([]);
  const [canContactRefs, setCanContactRefs] = useState(true);
  const [signupRequests, setSignupRequests] = useState<ApplicantRow[]>([]);
  const [sentOffers, setSentOffers] = useState<OrganizerOfferRow[]>([]);
  const [submittedRatings, setSubmittedRatings] = useState<RefRatingRow[]>([]);
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, { score: number; comment: string }>>({});
  const [ratingCutoffIso, setRatingCutoffIso] = useState("");
  const [offerEvent, setOfferEvent] = useState("");
  const [offerRef, setOfferRef] = useState("");
  const [inviteRef, setInviteRef] = useState<DirectoryRef | null>(null);
  const [contactRefId, setContactRefId] = useState<string | null>(null);
  const [contactSubject] = useState("Availability inquiry");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [checkoutEventId, setCheckoutEventId] = useState<string | null>(null);
  const [staffingEventId, setStaffingEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
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

    const organizerProfileResult = await supabase
      .from("organizer_profiles")
      .select("bio, primary_sport, additional_sports, rate_per_official, rate_type, rate_min, rate_max, id_document_path, logo_path, events_list_path")
      .eq("member_id", user.id)
      .maybeSingle();
    let op = organizerProfileResult.data;
    const opErr = organizerProfileResult.error;
    if (isMissingOrganizerRateColumn(opErr)) {
      const fallback = await supabase
        .from("organizer_profiles")
        .select("bio, primary_sport, additional_sports, rate_per_official, id_document_path, logo_path, events_list_path")
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
      setIdDocPath(op.id_document_path);
      setLogoPath(op.logo_path);
      setEventsListPath(op.events_list_path);
    }

    const eventResult = await supabase
      .from("scheduled_events")
      .select("id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, pay_type, pay_min, pay_max")
      .eq("organizer_member_id", user.id)
      .order("starts_at", { ascending: true });
    let ev = eventResult.data;
    const evErr = eventResult.error;
    if (isMissingPayRangeColumn(evErr)) {
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
    setSignupRequests(applicantsJson.applicants ?? []);

    const { data: offers } = await supabase
      .from("assignment_offers")
      .select(
        "id, event_id, ref_member_id, offered_pay, status, message, created_at, members ( display_name ), scheduled_events!inner ( title, sport, starts_at, ends_at, pay_offer, organizer_member_id )"
      )
      .eq("scheduled_events.organizer_member_id", user.id)
      .order("created_at", { ascending: false });
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
      setCanContactRefs(Boolean(dirJson.canContact));
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
    setCanContactRefs,
    setDisplayName,
    setEvents,
    setEventsListPath,
    setIdDocPath,
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
      if (panel === "marketplace") marketplaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, searchParams]);

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
    return rateType === "range" ? Boolean(rateMin.trim()) : Boolean(ratePerOfficial.trim());
  }

  function organizerPayLabel() {
    if (rateType === "range") {
      if (rateMin.trim() && rateMax.trim()) return `${rateMin}-${rateMax}`;
      if (rateMin.trim()) return `${rateMin}+`;
    }
    return ratePerOfficial;
  }

  function isOrganizerProfileComplete() {
    return Boolean(sport.trim() && hasOrganizerPay() && bio.trim());
  }

  function firstIncompleteOrganizerSetupStep(): OrganizerSetupStep {
    if (!sport.trim()) return "sport";
    if (!hasOrganizerPay()) return "pay";
    if (!bio.trim()) return "bio";
    if (!idDocPath) return "identity";
    return "events";
  }

  function requireOrganizerOnboarding() {
    if (isOrganizerProfileComplete()) return true;
    setSetupStep(firstIncompleteOrganizerSetupStep());
    setSetupModalOpen(true);
    setMsg("Finish your organizer profile first so refs know who they are working with.");
    return false;
  }

  function openSetup(step: OrganizerSetupStep) {
    setSetupStep(step);
    setSetupModalOpen(true);
  }

  function browseRefsForEvent(eventId: string) {
    setOfferEvent(eventId);
    setOfferRef("");
    window.requestAnimationFrame(() => {
      marketplaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openStaffingForEvent(eventId: string) {
    if (!requireOrganizerOnboarding()) return;
    setStaffingEventId(eventId);
    setOfferEvent(eventId);
    setOfferRef("");
  }

  function prefillEventDate(date: Date) {
    setStarts(toDatetimeLocalValue(date, 18));
    setEnds(toDatetimeLocalValue(date, 20));
    openSetup(isOrganizerProfileComplete() ? "events" : firstIncompleteOrganizerSetupStep());
    clearEventFeedback();
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
        const nextMissing = firstIncompleteOrganizerSetupStep();
        if (nextMissing !== current) {
          setSetupStep(nextMissing);
        } else {
          goToNextSetupStep(current);
        }
      }
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
    if (setupStep === "identity" && logoPath) setMsg("Organization ID and logo complete.");
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
    if (setupStep === "identity" && idDocPath) setMsg("Organization ID and logo complete.");
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
        goToNextSetupStep("events");
        return;
      }
    }
    setMsg("Events list uploaded. Use CSV (title,sport,starts_at,ends_at,zip,officials_needed,pay) to bulk-import.");
    await load();
    goToNextSetupStep("events");
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
      setPay("");
      setPayType("exact");
      setPayMin("");
      setPayMax("");
      const text = "Event published.";
      setEventMsg(text);
      setMsg(text);
      await load();
      goToNextSetupStep("events");
    } catch {
      const text = "Could not reach the server. Refresh and try again.";
      setEventMsg(text);
      setMsg(text);
    } finally {
      setPublishing(false);
    }
  }

  async function sendOfferFromRequest(applicant: ApplicantRow) {
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: applicant.eventId,
        refMemberId: applicant.refMemberId,
      }),
    });
    const j = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMsg(j.error || "Could not send request.");
      return;
    }
    setMsg("Invite sent — waiting for the ref to accept.");
    await load();
  }

  async function sendOffer(refMemberId = offerRef, eventId = offerEvent) {
    if (!requireOrganizerOnboarding()) return;
    if (!eventId || !refMemberId) {
      setMsg("Pick an event and a referee before sending the request.");
      return;
    }
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
    setMsg(res.ok ? "Request sent to referee. They will see it in their notification inbox." : j.error || "Could not send request.");
    if (res.ok) {
      setOfferRef("");
      setOfferEvent("");
    }
    await load();
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
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not save rating.");
        return;
      }
      setSubmittedRatings((current) => [
        ...current.filter((rating) => ratingKey(rating.event_id, rating.ref_member_id) !== key),
        { event_id: offer.event_id, ref_member_id: offer.ref_member_id, score, skipped },
      ]);
      setRatingDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setMsg(
        skipped
          ? "Rating skipped for this completed game."
          : "Review published. Thanks for helping organizers find trusted refs."
      );
      await load();
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setRatingSubmitting(null);
    }
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
    { step: "identity", label: "Organization ID & logo", done: Boolean(idDocPath && logoPath) },
  ];
  const currentSetup = setupActions.find((item) => item.step === setupStep) ?? setupActions[0];
  const normalizedMagicSearch = magicSearch.trim().toLowerCase();
  const ignoredOrganizerSearchTerms = new Set(["find", "a", "ref", "referee", "near", "tonight", "this", "weekend"]);
  const searchMatches = (text: string) =>
    !normalizedMagicSearch ||
    normalizedMagicSearch
      .split(/\s+/)
      .every((part) => ignoredOrganizerSearchTerms.has(part) || text.includes(part));
  const filteredEvents = events.filter((event) =>
    searchMatches(
      queryIncludes(
        event.title,
        event.sport,
        event.city,
        event.state,
        event.zip_code,
        event.pay_offer != null ? `$${event.pay_offer}` : "",
        formatEventDateTime(event.starts_at)
      )
    )
  );
  const filteredRefs = refs.filter((ref) =>
    searchMatches(queryIncludes(ref.gotrefsId, ref.primarySport, ref.homeZip, ref.ratePerGame != null ? `$${ref.ratePerGame}` : ""))
  );
  const selectedOfferEvent = events.find((event) => event.id === offerEvent) ?? null;
  const staffingEvent = events.find((event) => event.id === staffingEventId) ?? null;
  const matchingRefs = selectedOfferEvent
    ? filteredRefs.filter((ref) => {
        const available = ref.availability.some((slot) => slotCoversEvent(slot, selectedOfferEvent));
        const zipFits = locationFits(ref.homeZip, selectedOfferEvent.zip_code);
        const sportFits =
          ref.primarySport === selectedOfferEvent.sport ||
          selectedOfferEvent.sport === sport ||
          additionalSports.includes(selectedOfferEvent.sport);
        const priceFits = refPriceFitsEvent(ref, selectedOfferEvent);
        return available && zipFits && sportFits && priceFits;
      })
    : [];
  const manageMonthLabel = manageCalendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const manageEventsByDay = new Map<string, EventRow[]>();
  for (const event of filteredEvents) {
    const eventDate = new Date(event.starts_at);
    const key = dayKey(eventDate);
    manageEventsByDay.set(key, [...(manageEventsByDay.get(key) || []), event]);
  }
  const manageCalendarWeeks = buildMonthWeeks(manageCalendarCursor);
  const visibleManageEvents = selectedManageDate
    ? filteredEvents.filter((event) => sameDay(new Date(event.starts_at), selectedManageDate))
    : filteredEvents;
  const zipIsValid = /^\d{5}(-\d{4})?$/.test(zip.trim());
  const pendingSentOffers = sentOffers.filter((offer) => offer.status === "pending");
  const respondedSentOffers = sentOffers.filter((offer) => offer.status === "accepted" || offer.status === "declined");
  const organizerNotificationCount = signupRequests.length + respondedSentOffers.length;
  const acceptedOffersByEvent = sentOffers.reduce<Record<string, number>>((acc, offer) => {
    if (offer.status === "accepted") acc[offer.event_id] = (acc[offer.event_id] || 0) + 1;
    return acc;
  }, {});
  const acceptedOfferPaymentsByEvent = sentOffers.reduce<
    Record<string, { refSubtotalCents: number; platformFeeCents: number; totalCents: number }>
  >((acc, offer) => {
    if (offer.status !== "accepted") return acc;
    const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
    const refSubtotalCents = dollarsToCents(offer.offered_pay ?? event?.pay_offer);
    const current = acc[offer.event_id] ?? { refSubtotalCents: 0, platformFeeCents: 0, totalCents: 0 };
    const nextRefSubtotalCents = current.refSubtotalCents + refSubtotalCents;
    const nextPlatformFeeCents = Math.round(nextRefSubtotalCents * 0.1);
    acc[offer.event_id] = {
      refSubtotalCents: nextRefSubtotalCents,
      platformFeeCents: nextPlatformFeeCents,
      totalCents: nextRefSubtotalCents + nextPlatformFeeCents,
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

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 rounded-[2rem] border border-[var(--blue)]/20 bg-gradient-to-br from-[var(--blue)]/10 via-white to-[var(--red)]/10 p-5 shadow-sm lg:grid-cols-[1fr_0.9fr] lg:p-7">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--red)]">Organizer dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-[var(--navy)]">
            Explore your staffing marketplace.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
            Browse your schedule, discover verified referees, and finish your organizer profile only when you are ready
            to post or invite.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {!isOrganizerProfileComplete() ? (
              <button
                type="button"
                onClick={() => openSetup(firstIncompleteOrganizerSetupStep())}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] shadow-sm transition-all duration-200 hover:border-[var(--red)] hover:bg-[var(--red)] hover:text-white"
              >
                Complete organizer profile
              </button>
            ) : (
              <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
                Organizer profile ready.
              </p>
            )}
          </div>
        </div>
        <OrganizerIdCard
          contactName={displayName}
          organizationName={organizationName}
          email={accountEmail}
          primarySport={sport}
          additionalSports={additionalSports}
          typicalPay={organizerPayLabel()}
          bio={bio}
          eventsCount={events.length}
          idUploaded={Boolean(idDocPath)}
          logoUploaded={Boolean(logoPath)}
        />
      </div>

      <section className="py-2">
        <StickyMarketplaceSearch>
          <AirbnbMarketplaceSearch
            searchLabel="Search refs"
            fields={[
              {
                id: "organizer-ref-search",
                label: "Search refs",
                value: magicSearch,
                placeholder: "Basketball officials near 91322",
                onChange: setMagicSearch,
              },
            ]}
          />
        </StickyMarketplaceSearch>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Basketball", "Near 91322", "Tonight"].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setMagicSearch((current) => `${current} ${chip}`.trim())}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-900"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      {msg && (
        <div className="fixed right-4 top-20 z-40 max-w-sm rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] shadow-xl">
          <span className="mr-2" aria-hidden="true">✓</span>
          {msg}
        </div>
      )}

      <section ref={notificationsRef} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-black text-[var(--navy)]">Notification inbox</h2>
              {organizerNotificationCount > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--red)] px-2 text-xs font-black text-white">
                  {organizerNotificationCount}!
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ref requests and invite responses from the backend show up here.
            </p>
          </div>
          {pendingSentOffers.length > 0 && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
              {pendingSentOffers.length} invite{pendingSentOffers.length === 1 ? "" : "s"} awaiting response
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {signupRequests.slice(0, 4).map((sr) => (
              <button
                key={sr.id}
                type="button"
                onClick={() => applicantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="rounded-2xl border border-red-100 bg-red-50 p-4 text-left transition-all duration-200 hover:border-[var(--red)]"
              >
                <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">New ref application</p>
                <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                  Official {sr.gotrefsId} applied to ref {sr.eventTitle}.
                </p>
                {sr.ratingAverage != null && sr.ratingCount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    {renderStarScore(Math.round(sr.ratingAverage))} {sr.ratingAverage.toFixed(1)} ({sr.ratingCount} review
                    {sr.ratingCount === 1 ? "" : "s"})
                  </p>
                )}
              </button>
            ))}
          {respondedSentOffers.slice(0, 4).map((offer) => {
            const ev = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
            const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
            const officialId = refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`;
            const accepted = offer.status === "accepted";
            return (
              <article
                key={offer.id}
                className={`rounded-2xl border p-4 ${
                  accepted ? "border-green-100 bg-green-50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className={`text-xs font-black uppercase tracking-wide ${accepted ? "text-green-700" : "text-slate-600"}`}>
                  Invite {offer.status}
                </p>
                <p className="mt-1 text-sm font-bold text-[var(--navy)]">
                  Official {officialId} {accepted ? "accepted" : "declined"} {ev?.title ?? "your event"}.
                </p>
              </article>
            );
          })}
          {organizerNotificationCount === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)] md:col-span-2">
              No new requests yet. When refs apply or respond to your invite, you&apos;ll see it here.
            </div>
          )}
        </div>
      </section>

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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Organizer setup</p>
            <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">
              Step {ORGANIZER_SETUP_ORDER.indexOf(setupStep) + 1} of {ORGANIZER_SETUP_ORDER.length}: {currentSetup.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Complete only what is needed now. You can come back and polish the rest later.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSetupModalOpen(false)}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-[var(--navy)] transition-all duration-200 hover:bg-slate-50"
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
              Typical pay per official
              <div className="rounded-xl border border-[var(--border)] p-3">
                <div className="mb-3 flex gap-2 text-xs font-bold">
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
                    className="w-full rounded border border-[var(--border)] px-3 py-2"
                    value={ratePerOfficial}
                    onChange={(e) => setRatePerOfficial(e.target.value)}
                    placeholder="e.g. 45"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      className="rounded border border-[var(--border)] px-3 py-2"
                      value={rateMin}
                      onChange={(e) => setRateMin(e.target.value)}
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      min={0}
                      className="rounded border border-[var(--border)] px-3 py-2"
                      value={rateMax}
                      onChange={(e) => setRateMax(e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                )}
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Use a range when you are flexible so more refs can match your criteria.
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
            <div className="relative">
              <input
                required
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="e.g., 91322"
                className={`w-full rounded-xl border px-3 py-2 pr-10 outline-none transition-all duration-200 ${
                  zip && zipIsValid
                    ? "border-green-300 bg-green-50 focus:ring-2 focus:ring-green-100"
                    : "border-slate-200 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
                }`}
                value={zip}
                onChange={(e) => { setZip(e.target.value); clearEventFeedback(); }}
              />
              {zip && zipIsValid && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-green-600">✓</span>
              )}
            </div>
            {zip && !zipIsValid && <span className="text-xs text-amber-700">Use a 5-digit ZIP so refs can match by area.</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Officials needed
            <input type="number" min={1} className="rounded border px-2 py-1" value={needed} onChange={(e) => { setNeeded(Number(e.target.value)); clearEventFeedback(); }} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pay offer
            <div className="rounded-xl border border-slate-200 p-2">
              <div className="mb-2 flex gap-2 text-xs font-bold">
                {(["exact", "range"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPayType(type);
                      clearEventFeedback();
                    }}
                    className={`rounded-full px-3 py-1 capitalize ${
                      payType === type ? "bg-[var(--navy)] text-white" : "bg-slate-100 text-[var(--muted)]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {payType === "exact" ? (
                <input
                  type="number"
                  min={0}
                  className="w-full rounded border px-2 py-1"
                  value={pay}
                  onChange={(e) => { setPay(e.target.value); clearEventFeedback(); }}
                  placeholder="e.g. 45"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    className="rounded border px-2 py-1"
                    value={payMin}
                    onChange={(e) => { setPayMin(e.target.value); clearEventFeedback(); }}
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min={0}
                    className="rounded border px-2 py-1"
                    value={payMax}
                    onChange={(e) => { setPayMax(e.target.value); clearEventFeedback(); }}
                    placeholder="Max"
                  />
                </div>
              )}
            </div>
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
            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--grey-light)]/40 p-4">
              <h3 className="font-bold text-[var(--blue)]">Upload events list</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                CSV columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="mt-3 text-sm"
                onChange={(e) => void uploadEventsList(e)}
              />
              {eventsListPath && <p className="mt-2 text-sm text-green-700">Events list file saved.</p>}
            </div>
          </div>
        )}

        {setupStep === "identity" && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
              <p className="font-display text-lg font-bold text-[var(--navy)]">Government ID or league credential</p>
              <p className="mt-1 text-sm text-[var(--muted)]">JPG, PNG, or PDF</p>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="mt-4 text-sm" onChange={(e) => void uploadId(e)} />
              {idDocPath && <p className="mt-2 text-sm text-green-700">ID on file.</p>}
            </div>
            <div className="rounded-xl border-2 border-[var(--blue)]/25 bg-[var(--grey-light)]/40 p-5">
              <p className="font-display text-lg font-bold text-[var(--navy)]">Organization logo</p>
              <p className="mt-1 text-sm text-[var(--muted)]">PNG, JPG, SVG, or WEBP</p>
              <input type="file" accept=".jpg,.jpeg,.png,.svg,.webp" className="mt-4 text-sm" onChange={(e) => void uploadLogo(e)} />
              {logoPath && <p className="mt-2 text-sm text-green-700">Logo on file.</p>}
            </div>
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

      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Manage events</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--blue)]">Your upcoming events</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Track staffing, review applicants, and invite available referees for each game.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-[var(--border)] bg-[var(--grey-light)] p-1">
              {(["list", "calendar"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setManageViewMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-black capitalize transition-all duration-200 ${
                    manageViewMode === mode
                      ? "bg-white text-[var(--navy)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--navy)]"
                  }`}
                >
                  {mode} View
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!requireOrganizerOnboarding()) return;
                openSetup("events");
              }}
              className="rounded-full bg-[var(--red)] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-[var(--red-dark)]"
            >
              Add event
            </button>
          </div>
        </div>
        {manageViewMode === "calendar" && (
          <div className="mt-5 grid gap-5 transition-all duration-200 lg:grid-cols-[1.15fr_0.85fr]">
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
                                <p className="mt-2 font-bold text-[var(--blue)]">Click badge, then browse refs below.</p>
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
                Click a blank date to prefill the Add Event form. Click a date with games to filter the list.
              </p>
            </div>
            <div className="rounded-2xl border border-[#F1F5F9] bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">
                    {selectedManageDate ? selectedManageDate.toLocaleDateString() : "All upcoming games"}
                  </p>
                  <h3 className="mt-1 font-black text-[var(--navy)]">Event cards</h3>
                </div>
                {selectedManageDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedManageDate(null)}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-bold transition-all duration-200 hover:bg-[var(--grey-light)]"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                {visibleManageEvents.map((e) => {
                  const loc = formatEventLocation(e.city, e.state, e.zip_code);
                  const applicantCount = signupRequests.filter((request) => request.eventId === e.id).length;
                  const hiredCount = acceptedOffersByEvent[e.id] || 0;
                  const payment = acceptedOfferPaymentsByEvent[e.id];
                  const filled = hiredCount >= e.officials_needed;
                  return (
                    <article key={e.id} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="font-black text-[var(--navy)]">{e.title}</h4>
                          <p className="mt-1 text-xs text-[var(--muted)]">{formatEventDateTime(e.starts_at)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{loc || `ZIP ${e.zip_code}`}</p>
                        </div>
                        <span className="rounded-full bg-[var(--blue)]/10 px-2.5 py-1 text-xs font-bold text-[var(--blue)]">
                          {e.sport}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            filled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {hiredCount}/{e.officials_needed} Refs Hired
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {payment && payment.totalCents > 0 && (
                            <button
                              type="button"
                              disabled={checkoutEventId === e.id}
                              onClick={() => void startStripeCheckout(e.id)}
                              className="rounded-full bg-[var(--navy)] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[var(--blue)] disabled:opacity-60"
                            >
                              {checkoutEventId === e.id ? "Opening Stripe..." : `Pay ${formatCents(payment.totalCents)}`}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (applicantCount > 0) {
                                applicantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                              } else {
                                browseRefsForEvent(e.id);
                              }
                            }}
                            className="rounded-full bg-[var(--red)] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[var(--red-dark)]"
                          >
                            {applicantCount > 0 ? `View Applicants (${applicantCount})` : "Browse Refs"}
                          </button>
                        </div>
                      </div>
                      {payment && payment.totalCents > 0 && (
                        <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                          Includes {formatCents(payment.refSubtotalCents)} ref pay + {formatCents(payment.platformFeeCents)} GotREFS fee.
                        </p>
                      )}
                    </article>
                  );
                })}
                {visibleManageEvents.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-center">
                    <p className="text-2xl" aria-hidden="true">📋</p>
                    <p className="mt-2 text-sm font-bold text-[var(--navy)]">No events on this date.</p>
                    <button
                      type="button"
                      onClick={() => prefillEventDate(selectedManageDate ?? manageCalendarCursor)}
                      className="mt-3 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold transition-all duration-200 hover:bg-[var(--grey-light)]"
                    >
                      Add event here
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className={`mt-5 grid gap-4 transition-opacity duration-200 ${manageViewMode === "calendar" ? "hidden" : ""}`}>
          {visibleManageEvents.map((e) => {
            const loc = formatEventLocation(e.city, e.state, e.zip_code);
            const payLabel = formatPayRange(e);
            const applicantCount = signupRequests.filter((request) => request.eventId === e.id).length;
            const hiredCount = acceptedOffersByEvent[e.id] || 0;
            const payment = acceptedOfferPaymentsByEvent[e.id];
            const filled = hiredCount >= e.officials_needed;
            return (
              <article
                key={e.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1.1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-[var(--navy)]">{e.title}</h3>
                      <span className="rounded-full bg-[var(--blue)]/10 px-3 py-1 text-xs font-bold text-[var(--blue)]">
                        {e.sport}
                      </span>
                    </div>
                    {payLabel && <p className="mt-2 text-sm font-bold text-emerald-700">Offer {payLabel} per official</p>}
                  </div>
                  <div className="grid gap-2 text-sm text-[var(--slate)]">
                    <p className="flex items-center gap-2">
                      <span aria-hidden="true">📅</span>
                      <span>{formatEventDateTime(e.starts_at)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span aria-hidden="true">📍</span>
                      <span>{loc || `ZIP ${e.zip_code}`}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        filled ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {hiredCount}/{e.officials_needed} Refs Hired
                    </span>
                    {payment && payment.totalCents > 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-[var(--slate)]">
                        <span className="block font-black text-[var(--navy)]">
                          Payment due: {formatCents(payment.totalCents)}
                        </span>
                        <span>
                          {formatCents(payment.refSubtotalCents)} ref pay + {formatCents(payment.platformFeeCents)} GotREFS fee
                        </span>
                      </div>
                    )}
                    {payment && payment.totalCents > 0 && (
                      <button
                        type="button"
                        disabled={checkoutEventId === e.id}
                        onClick={() => void startStripeCheckout(e.id)}
                        className="rounded-full bg-[var(--navy)] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[var(--blue)] disabled:opacity-60"
                      >
                        {checkoutEventId === e.id ? "Opening Stripe..." : "Pay with Stripe"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openStaffingForEvent(e.id)}
                      className="rounded-full bg-[var(--red)] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[var(--red-dark)]"
                    >
                      {applicantCount > 0 ? `Staff game (${applicantCount} applied)` : "Staff game"}
                    </button>
                    <button
                      type="button"
                      onClick={() => browseRefsForEvent(e.id)}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] transition-all duration-200 hover:border-[var(--blue)]"
                    >
                      Browse all refs
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {visibleManageEvents.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-8 text-center">
              <p className="text-3xl" aria-hidden="true">📋</p>
              <h3 className="mt-2 font-bold text-[var(--navy)]">
                {events.length === 0 ? "No upcoming events yet." : "No events on this date."}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Add a game to start matching with referees.</p>
            </div>
          )}
        </div>
      </section>

      {completedUnratedOffers.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Completed games</p>
              <h2 className="mt-1 font-display text-xl font-bold text-[var(--navy)]">Rate your refs</h2>
              <p className="mt-1 text-sm text-amber-900">
                Help organizers find trusted officials. Ratings only appear after completed games.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">
              {completedUnratedOffers.length} pending
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {completedUnratedOffers.slice(0, 4).map((offer) => {
              const event = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
              const key = ratingKey(offer.event_id, offer.ref_member_id);
              const refMeta = refs.find((ref) => ref.id === offer.ref_member_id);
              const officialId = refMeta?.gotrefsId ?? `GR-${offer.ref_member_id.slice(0, 8).toUpperCase()}`;
              const draft = ratingDrafts[key] ?? { score: 5, comment: "" };
              return (
                <article key={key} className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="space-y-4">
                    <div>
                      <p className="font-black text-[var(--navy)]">{event?.title ?? "Completed game"}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                        Official {officialId} ·{" "}
                        {event?.starts_at ? formatEventDateTime(event.starts_at) : "Game complete"}
                      </p>
                      <p className="mt-2 text-sm text-amber-900">
                        How was this ref? Share a star rating and a short review — like checking out on Airbnb.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Overall rating</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            type="button"
                            disabled={ratingSubmitting === key}
                            onClick={() =>
                              setRatingDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, score },
                              }))
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-black transition-all duration-200 disabled:opacity-50 ${
                              draft.score === score
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            }`}
                          >
                            {renderStarScore(score)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block text-sm font-bold text-[var(--navy)]">
                      Written review (optional)
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-normal text-[var(--slate)]"
                        placeholder="Professional, on time, great with players..."
                        value={draft.comment}
                        disabled={ratingSubmitting === key}
                        onChange={(event) =>
                          setRatingDrafts((current) => ({
                            ...current,
                            [key]: { ...draft, comment: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={ratingSubmitting === key}
                        onClick={() => void submitRating(offer, draft.score, false, draft.comment)}
                        className="rounded-full bg-[var(--navy)] px-4 py-2 text-xs font-black text-white transition-all duration-200 hover:bg-[var(--blue)] disabled:opacity-50"
                      >
                        {ratingSubmitting === key ? "Publishing..." : "Publish review"}
                      </button>
                      <button
                        type="button"
                        disabled={ratingSubmitting === key}
                        onClick={() => void submitRating(offer, null, true)}
                        className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-bold text-[var(--muted)] transition-all duration-200 hover:bg-[var(--grey-light)] disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {signupRequests.length > 0 && (
        <section ref={applicantsRef} className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-[var(--red)]">Ref applications on your events</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Referees who applied to work one of your events. You only see their GotREFS ID, star rating, and past reviews — not their name.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {signupRequests.map((sr) => (
              <li key={sr.id} className="rounded-2xl border px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[var(--navy)]">Official {sr.gotrefsId}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Requested to work <strong>{sr.eventTitle}</strong>
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--blue)]">
                      {sr.ratingAverage != null && sr.ratingCount > 0
                        ? `${renderStarScore(Math.round(sr.ratingAverage))} ${sr.ratingAverage.toFixed(1)} · ${sr.ratingCount} past review${sr.ratingCount === 1 ? "" : "s"}`
                        : "No reviews yet"}
                    </p>
                    {sr.refRateLabel && (
                      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Ref rate: {sr.refRateLabel}</p>
                    )}
                    {sr.eventPayLabel && (
                      <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Your event pay: {sr.eventPayLabel}</p>
                    )}
                    {sr.reviews.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {sr.reviews.map((review) => (
                          <blockquote
                            key={`${review.createdAt}-${review.score}`}
                            className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-[var(--slate)]"
                          >
                            <p className="font-bold text-amber-700">{renderStarScore(review.score)}</p>
                            <p className="mt-1">{review.comment?.trim() || "No written comment."}</p>
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-[var(--blue)] px-4 py-2 text-xs font-bold text-white"
                    onClick={() => void sendOfferFromRequest(sr)}
                  >
                    Request this ref
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section ref={marketplaceRef} className="space-y-5 py-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Hire verified refs</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Browse by GotREFS ID, rating, and pay fit — like finding the right stay on Airbnb.
            </p>
          </div>
          {selectedOfferEvent && (
            <button
              type="button"
              onClick={() => {
                setOfferEvent("");
                setOfferRef("");
              }}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Clear event filter
            </button>
          )}
        </div>
        {!canContactRefs && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Sign up and log in as a registered event organizer to browse ref availability and contact refs.
          </p>
        )}
        {canContactRefs && (
          <>
            {selectedOfferEvent && (
              <p className="mt-4 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 px-4 py-3 text-sm text-[var(--slate)]">
                Showing refs available for <strong>{selectedOfferEvent.title}</strong> on{" "}
                <strong>{formatEventDateTime(selectedOfferEvent.starts_at)}</strong>
                {selectedOfferEvent.zip_code ? ` near ZIP ${selectedOfferEvent.zip_code}` : ""}.
              </p>
            )}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(selectedOfferEvent ? matchingRefs : filteredRefs).slice(0, 20).map((r) => {
                const cardAvailability = selectedOfferEvent
                  ? r.availability.filter((slot) => slotCoversEvent(slot, selectedOfferEvent)).slice(0, 1)
                  : r.availability.slice(0, 1);
                const priceFits = selectedOfferEvent ? refPriceFitsEvent(r, selectedOfferEvent) : true;
                const availabilityLabel =
                  cardAvailability.length > 0
                    ? `Available ${new Date(cardAvailability[0].start_at).toLocaleDateString()} – ${new Date(cardAvailability[0].end_at).toLocaleDateString()}`
                    : "No posted availability for this window";
                return (
                  <div key={r.id}>
                    <RefListingCard
                      gotrefsId={r.gotrefsId}
                      primarySport={r.primarySport}
                      rateLabel={formatRefRate(r)}
                      ratingAverage={r.ratingAverage}
                      ratingCount={r.ratingCount}
                      reviewSnippet={r.reviews?.[0]?.comment}
                      availabilityLabel={availabilityLabel}
                      priceFits={selectedOfferEvent ? priceFits : undefined}
                      inviteDisabled={selectedOfferEvent ? !priceFits : false}
                      inviteLabel={
                        selectedOfferEvent
                          ? priceFits
                            ? "Request this ref"
                            : "Outside pay range"
                          : "Invite to game"
                      }
                      onMessage={() => {
                        setContactRefId(contactRefId === r.id ? null : r.id);
                        setContactMessage("We'd love for you to ref for our upcoming event.");
                      }}
                      onInvite={() => {
                        if (!requireOrganizerOnboarding()) return;
                        if (selectedOfferEvent) {
                          if (!priceFits) {
                            setMsg("This ref's hourly rate is outside your event pay range.");
                            return;
                          }
                          void sendOffer(r.id, selectedOfferEvent.id);
                          return;
                        }
                        setInviteRef(r);
                      }}
                    />
                    {contactRefId === r.id && (
                      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <textarea
                          className="min-h-[72px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                        />
                        <button
                          type="button"
                          disabled={contactSending}
                          className="mt-2 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          onClick={() => void sendContact(r.id)}
                        >
                          {contactSending ? "Sending…" : "Send message"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {filteredRefs.length === 0 && !selectedOfferEvent && (
              <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-8 text-center">
                <p className="text-3xl" aria-hidden="true">🔎</p>
                <h3 className="mt-2 font-bold text-[var(--navy)]">No refs match this game yet.</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Try expanding your pay range, ZIP radius, or event window. Refs can still apply from the open games calendar.
                </p>
              </div>
            )}
            {selectedOfferEvent && filteredRefs.length > 0 && matchingRefs.length === 0 && (
              <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-8 text-center">
                <p className="text-3xl" aria-hidden="true">🔎</p>
                <h3 className="mt-2 font-bold text-[var(--navy)]">No refs match this game yet.</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Try expanding your pay range, ZIP radius, or event window. Refs can still apply from the open games calendar.
                </p>
              </div>
            )}
          </>
        )}
      </section>
      {inviteRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setInviteRef(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Invite referee</p>
                <h3 className="mt-1 text-2xl font-black text-[var(--navy)]">Official {inviteRef.gotrefsId}</h3>
              </div>
              <button type="button" className="rounded-full border border-[var(--border)] px-3 py-1 text-sm" onClick={() => setInviteRef(null)}>
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">Select the game you want this referee to work.</p>
            <div className="mt-4 grid gap-2">
              {events.map((event) => {
                const priceFits = refPriceFitsEvent(inviteRef, event);
                return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    setOfferEvent(event.id);
                    setOfferRef(inviteRef.id);
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                    offerEvent === event.id ? "border-[var(--red)] bg-[var(--red-light)]" : "border-[var(--border)] hover:border-[var(--blue)]"
                  }`}
                >
                  <p className="font-bold text-[var(--navy)]">{event.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatEventDateTime(event.starts_at)} · {event.sport}</p>
                  <p className={`mt-1 text-xs font-semibold ${priceFits ? "text-green-700" : "text-amber-700"}`}>
                    {priceFits ? "Pay range matches this ref" : "Outside this ref's hourly rate"}
                  </p>
                </button>
              );
              })}
            </div>
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--grey-light)]/40 p-3 text-sm">
              We&apos;d love for you to ref for our upcoming event.
            </div>
            <button
              type="button"
              disabled={
                !offerEvent ||
                !events.some((event) => event.id === offerEvent && refPriceFitsEvent(inviteRef, event))
              }
              onClick={() => {
                void sendOffer();
                setInviteRef(null);
              }}
              className="mt-4 w-full rounded-full bg-[var(--red)] px-4 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-[var(--red-dark)] disabled:opacity-50"
            >
              Send request
            </button>
          </div>
        </div>
      )}

      {staffingEvent && (
        <EventStaffingPanel
          event={staffingEvent}
          applicants={signupRequests}
          refs={refs.map((ref) => ({
            id: ref.id,
            gotrefsId: ref.gotrefsId,
            primarySport: ref.primarySport,
            ratingAverage: ref.ratingAverage,
            ratingCount: ref.ratingCount,
            rateLabel: formatRefRate(ref),
            homeZip: ref.homeZip,
            availability: ref.availability,
            rateType: ref.rateType,
            rateMin: ref.rateMin,
            rateMax: ref.rateMax,
            ratePerGame: ref.ratePerGame,
          }))}
          hiredCount={acceptedOffersByEvent[staffingEvent.id] || 0}
          onClose={() => setStaffingEventId(null)}
          onInviteApplicant={async (applicant) => {
            await sendOfferFromRequest(applicant as ApplicantRow);
          }}
          onInviteRef={async (refId) => {
            await sendOffer(refId, staffingEvent.id);
          }}
        />
      )}
    </div>
  );
}
