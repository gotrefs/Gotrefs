"use client";

import { useEffect, useMemo, useState } from "react";
import { PlacesWhereInput } from "@/components/marketplace/PlacesWhereInput";
import { VenuePinMap } from "@/components/organizer/VenuePinMap";
import { SportsFields } from "@/components/SportsFields";
import { EVENT_BOOSTS } from "@/lib/boosts";
import { sportListingVisual } from "@/lib/marketplace/airbnb-styles";

export type OrganizerWizardDraft = {
  venueType: string;
  accessType: string;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  addressLabel: string;
  lat: number | null;
  lng: number | null;
  officialsNeeded: number;
  sport: string;
  additionalSports: string[];
  gameLevel: string;
  refInstructions: string;
  rateType: "exact" | "range";
  ratePerOfficial: string;
  rateMin: string;
  rateMax: string;
  bio: string;
  discounts: string[];
  billingStreet: string;
  billingUnit: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  clubName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type PayoutMethodPayload = {
  method: "fastpay" | "bank" | "paypal";
  accountHolder: string;
  accountType: "checking" | "savings" | "";
  last4: string;
};

type WizardScreen =
  | "intro1"
  | "venueType"
  | "accessType"
  | "addressSearch"
  | "confirmAddress"
  | "pinMap"
  | "locationPrivacy"
  | "basics"
  | "schedule"
  | "intro2"
  | "gameLevel"
  | "sport"
  | "refInstructions"
  | "bio"
  | "intro3"
  | "prices"
  | "discounts"
  | "contact"
  | "finalDetails"
  | "done";

const STEP1_SCREENS: WizardScreen[] = [
  "intro1",
  "venueType",
  "accessType",
  "addressSearch",
  "confirmAddress",
  "pinMap",
  "locationPrivacy",
  "basics",
  "schedule",
];
const STEP2_SCREENS: WizardScreen[] = ["intro2", "gameLevel", "sport", "refInstructions", "bio"];
const STEP3_SCREENS: WizardScreen[] = ["intro3", "prices", "discounts", "contact", "finalDetails"];
const ALL_SCREENS: WizardScreen[] = [...STEP1_SCREENS, ...STEP2_SCREENS, ...STEP3_SCREENS, "done"];

const GAME_LEVELS = [
  { id: "youth", title: "Youth / recreational", subtitle: "U8–U14 or community rec leagues" },
  { id: "middle_school", title: "Middle school", subtitle: "Junior high / middle school games" },
  { id: "high_school", title: "High school", subtitle: "JV, varsity, or high school tournaments" },
  { id: "college", title: "College / club", subtitle: "NCAA, NAIA, junior college, or club" },
  { id: "adult", title: "Adult / open", subtitle: "Adult rec, men's / women's leagues" },
  { id: "tournament", title: "Tournament / showcase", subtitle: "Multi-game events or showcases" },
] as const;

export function gameLevelLabel(id: string): string | undefined {
  return GAME_LEVELS.find((level) => level.id === id)?.title;
}

const VENUE_TYPES = [
  { id: "gym", label: "Gym", emoji: "🏟️" },
  { id: "field", label: "Field", emoji: "🌿" },
  { id: "court", label: "Court", emoji: "🏀" },
  { id: "stadium", label: "Stadium", emoji: "🏟️" },
  { id: "school", label: "School", emoji: "🏫" },
  { id: "arena", label: "Arena", emoji: "🏒" },
  { id: "park", label: "Park", emoji: "🌳" },
  { id: "rec_center", label: "Rec center", emoji: "🏢" },
  { id: "community", label: "Community center", emoji: "🏛️" },
  { id: "club", label: "Club", emoji: "⭐" },
  { id: "indoor", label: "Indoor facility", emoji: "🏠" },
  { id: "other", label: "Other", emoji: "📍" },
] as const;

const ACCESS_TYPES = [
  { id: "entire", title: "An entire venue", subtitle: "Refs work the whole facility for your event.", emoji: "🏠" },
  { id: "shared", title: "A shared facility", subtitle: "Your game shares the venue with other activities.", emoji: "🚪" },
  { id: "outdoor", title: "An outdoor field or court", subtitle: "Open-air space — fields, courts, tracks, parks.", emoji: "🌿" },
] as const;

const DISCOUNT_OPTIONS = EVENT_BOOSTS.map((boost) => ({
  ...boost,
  percentLabel: `${boost.percent}%`,
}));

function parseUsAddress(label: string): Partial<OrganizerWizardDraft> {
  const cleaned = label.replace(/,?\s*USA$/i, "").trim();
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const street = parts[0] ?? "";
    const city = parts[1] ?? "";
    const stateZip = parts[2] ?? "";
    const match = stateZip.match(/^([A-Za-z.\s]+)\s+(\d{5}(?:-\d{4})?)$/);
    return {
      street,
      city,
      state: match?.[1]?.trim() ?? stateZip,
      zip: match?.[2] ?? "",
      addressLabel: label,
    };
  }
  return { addressLabel: label, street: label };
}

function StepperRow({
  label,
  value,
  min = 1,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  /** Omit for no upper limit. */
  max?: number;
  onChange: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function clamp(n: number) {
    let next = Math.max(min, n);
    if (typeof max === "number") next = Math.min(max, next);
    return next;
  }

  function commit(raw: string) {
    const digits = raw.replace(/[^\d]/g, "");
    if (!digits) {
      onChange(min);
      setText(String(min));
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed)) {
      onChange(min);
      setText(String(min));
      return;
    }
    const next = clamp(parsed);
    onChange(next);
    setText(String(next));
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 py-6 last:border-b-0">
      <p className="text-lg font-medium text-neutral-900">{label}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-xl text-neutral-700 transition hover:border-neutral-900 disabled:opacity-30"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            setText(digits);
            if (!digits) return;
            const parsed = Number.parseInt(digits, 10);
            if (!Number.isFinite(parsed)) return;
            onChange(clamp(parsed));
          }}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-14 min-w-6 border-0 bg-transparent p-0 text-center text-base font-medium text-neutral-900 outline-none focus:ring-0"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={typeof max === "number" && value >= max}
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-xl text-neutral-700 transition hover:border-neutral-900 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function AddressField({
  label,
  value,
  onChange,
  placeholder,
  as = "input",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  as?: "input" | "select";
}) {
  return (
    <label className="block border-b border-neutral-300 px-4 py-3 last:border-b-0">
      <span className="block text-xs text-neutral-500">{label}</span>
      {as === "select" ? (
        <select
          className="mt-0.5 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="United States">United States - US</option>
        </select>
      ) : (
        <input
          className="mt-0.5 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function GreenCheck({ size = "md", label }: { size?: "sm" | "md"; label?: string }) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white`}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={icon}>
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

type PayoutStage = "prompt" | "method" | "holder" | "bank" | null;

export function OrganizerListingWizard({
  organizationName,
  saving,
  idDocPath,
  logoPath,
  avatarPath = null,
  initialDraft,
  payoutOnly = false,
  onSaveProfile,
  onUploadId,
  onUploadLogo,
  onUploadAvatar,
  onSavePayoutMethod,
  onCreateEvent,
  onSaveAndExit,
  onComplete,
}: {
  organizationName?: string;
  saving?: boolean;
  idDocPath: string | null;
  logoPath: string | null;
  avatarPath?: string | null;
  initialDraft?: Partial<OrganizerWizardDraft>;
  /** Skip the listing flow and open straight into the payout-method steps. */
  payoutOnly?: boolean;
  onSaveProfile: (draft: OrganizerWizardDraft) => Promise<boolean>;
  onUploadId: (file: File) => Promise<void>;
  onUploadLogo: (file: File) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<void>;
  onSavePayoutMethod?: (payload: PayoutMethodPayload) => Promise<boolean>;
  onCreateEvent?: (draft: OrganizerWizardDraft) => Promise<boolean>;
  onSaveAndExit?: (draft: OrganizerWizardDraft) => void;
  onComplete: (draft: OrganizerWizardDraft) => void;
}) {
  const [screen, setScreen] = useState<WizardScreen>(payoutOnly ? "done" : "intro1");
  const [country] = useState("United States");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [payoutStage, setPayoutStage] = useState<PayoutStage>(payoutOnly ? "prompt" : null);
  const [payoutMethod, setPayoutMethod] = useState<"fastpay" | "bank" | "paypal" | "">("");
  const [payoutHolder, setPayoutHolder] = useState("");
  const [payoutAccountType, setPayoutAccountType] = useState<"checking" | "savings" | "">("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountNumberConfirm, setAccountNumberConfirm] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  /** After the first post, skip venue/pay/ID and only collect the next game's schedule. */
  const [quickRepost, setQuickRepost] = useState(false);
  const [draft, setDraft] = useState<OrganizerWizardDraft>({
    venueType: "",
    accessType: "",
    street: "",
    unit: "",
    city: "",
    state: "",
    zip: "",
    addressLabel: "",
    lat: null,
    lng: null,
    officialsNeeded: 2,
    sport: "",
    additionalSports: [],
    gameLevel: "",
    refInstructions: "",
    rateType: "exact",
    ratePerOfficial: "",
    rateMin: "",
    rateMax: "",
    bio: "",
    discounts: ["new_listing"],
    billingStreet: "",
    billingUnit: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    eventTitle: "",
    eventStart: "",
    eventEnd: "",
    clubName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    ...initialDraft,
  });

  const visual = sportListingVisual(draft.sport || "Basketball");

  const previewTitle = useMemo(() => {
    const place = draft.city ? `${draft.city}, ${draft.state || "CA"}` : "your city";
    const venue = VENUE_TYPES.find((v) => v.id === draft.venueType)?.label ?? "Venue";
    return `${venue} in ${place}`;
  }, [draft.city, draft.state, draft.venueType]);

  const basePrice = Number(draft.rateType === "range" ? draft.rateMin : draft.ratePerOfficial) || 0;
  const similarLow = basePrice > 0 ? Math.max(15, Math.round(basePrice * 0.7)) : 25;
  const similarHigh = basePrice > 0 ? Math.round(basePrice * 1.4) : 75;

  // Segmented progress: fraction complete within each of the 3 phases
  const progress = useMemo(() => {
    const idx1 = STEP1_SCREENS.indexOf(screen);
    const idx2 = STEP2_SCREENS.indexOf(screen);
    const idx3 = STEP3_SCREENS.indexOf(screen);
    if (screen === "done") return [1, 1, 1];
    if (idx1 >= 0) return [idx1 / STEP1_SCREENS.length, 0, 0];
    if (idx2 >= 0) return [1, idx2 / STEP2_SCREENS.length, 0];
    return [1, 1, Math.max(0, idx3) / STEP3_SCREENS.length];
  }, [screen]);

  function patch(next: Partial<OrganizerWizardDraft>) {
    setError(null);
    setDraft((current) => ({ ...current, ...next }));
  }

  function goBack() {
    setError(null);
    if (quickRepost && screen === "schedule") {
      setScreen("done");
      return;
    }
    const idx = ALL_SCREENS.indexOf(screen);
    if (idx > 0) setScreen(ALL_SCREENS[idx - 1]);
  }

  function goNext() {
    setError(null);
    const idx = ALL_SCREENS.indexOf(screen);
    if (idx < ALL_SCREENS.length - 1) setScreen(ALL_SCREENS[idx + 1]);
  }

  async function handleNext() {
    if (screen === "venueType" && !draft.venueType) {
      setError("Pick the option that best describes your venue.");
      return;
    }
    if (screen === "accessType" && !draft.accessType) {
      setError("Choose how refs will use the venue.");
      return;
    }
    if (screen === "addressSearch" && !draft.lat) {
      setError("Search and select an address to continue.");
      return;
    }
    if (screen === "confirmAddress") {
      if (!draft.street.trim() || !draft.city.trim() || !draft.zip.trim()) {
        setError("Street, city, and ZIP are required.");
        return;
      }
      if (!/^\d{5}(-\d{4})?$/.test(draft.zip.trim())) {
        setError("Enter a valid 5-digit ZIP.");
        return;
      }
      const label =
        draft.addressLabel ||
        [draft.street, draft.city, `${draft.state} ${draft.zip}`.trim(), "USA"].filter(Boolean).join(", ");
      patch({ addressLabel: label });
    }
    if (screen === "schedule") {
      if (!draft.eventStart.trim()) {
        setError("Pick when your event starts.");
        return;
      }
      if (draft.eventEnd.trim() && draft.eventEnd < draft.eventStart) {
        setError("The end time can't be before the start time.");
        return;
      }
      if (quickRepost && onCreateEvent) {
        setError(null);
        const posted = await onCreateEvent(draft);
        if (!posted) return;
        setScreen("done");
        return;
      }
    }
    if (screen === "gameLevel" && !draft.gameLevel) {
      setError("Pick the level that best matches your games.");
      return;
    }
    if (screen === "sport" && !draft.sport.trim()) {
      setError("Choose a primary sport.");
      return;
    }
    if (screen === "bio") {
      if (!draft.bio.trim()) {
        setError("Tell refs a bit about your organization.");
        return;
      }
      const saved = await onSaveProfile(draft);
      if (!saved) return;
    }
    if (screen === "prices") {
      const ok = draft.rateType === "range" ? Boolean(draft.rateMin.trim()) : Boolean(draft.ratePerOfficial.trim());
      if (!ok) {
        setError("Set a base pay per official.");
        return;
      }
      const saved = await onSaveProfile(draft);
      if (!saved) return;
    }
    if (screen === "contact") {
      if (!draft.contactName.trim()) {
        setError("Add a contact name so refs know who they're working with.");
        return;
      }
      if (!draft.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())) {
        setError("Enter a valid email address.");
        return;
      }
      if (!draft.contactPhone.trim()) {
        setError("Add a phone number in case a ref needs to reach you.");
        return;
      }
    }
    if (screen === "finalDetails") {
      if (!idDocPath || !logoPath) {
        setError("Upload your ID and organization logo to create your listing.");
        return;
      }
      const saved = await onSaveProfile(draft);
      if (!saved) return;
      if (onCreateEvent) {
        const posted = await onCreateEvent(draft);
        if (!posted) return;
      }
      setScreen("done");
      setPayoutStage("prompt");
      return;
    }
    goNext();
  }

  async function finishPayout(skip: boolean) {
    if (!skip && onSavePayoutMethod) {
      setSavingPayout(true);
      try {
        await onSavePayoutMethod({
          method: (payoutMethod || "bank") as PayoutMethodPayload["method"],
          accountHolder: payoutHolder,
          accountType: payoutAccountType,
          last4: accountNumber.slice(-4),
        });
      } finally {
        setSavingPayout(false);
      }
    }
    setPayoutStage(null);
    if (payoutOnly) {
      onComplete(draft);
      return;
    }
    // Stay on the done screen so hosts can post another game at the same venue (Airbnb-style).
  }

  function startAnotherEvent() {
    setQuickRepost(true);
    setError(null);
    patch({
      eventTitle: "",
      eventStart: "",
      eventEnd: "",
    });
    setScreen("schedule");
  }

  const nextLabel =
    screen === "finalDetails"
      ? "Post event"
      : screen === "schedule" && quickRepost
        ? "Post this game"
        : screen.startsWith("intro")
          ? "Get started"
          : "Next";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-8">
        <p className="text-sm font-semibold tracking-tight text-neutral-900">gotrefs</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Questions?
          </button>
          <button
            type="button"
            disabled={Boolean(saving)}
            onClick={() => void onSaveProfile(draft).then(() => (onSaveAndExit ?? onComplete)(draft))}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            Save & exit
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
          {screen === "intro1" && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Step 1</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Tell us about your place
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  In this step, we&apos;ll ask what kind of venue you have, where the game is, and how many
                  refs you need.
                </p>
              </div>
              <div className="overflow-hidden rounded-[2rem] bg-[#dbe7f3]">
                <div className={`aspect-[4/3] bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-7xl`}>
                  {visual.emoji}
                </div>
              </div>
            </div>
          )}

          {screen === "venueType" && (
            <div>
              <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Which of these best describes your place?
              </h1>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {VENUE_TYPES.map((venue) => {
                  const selected = draft.venueType === venue.id;
                  return (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => patch({ venueType: venue.id })}
                      className={`rounded-2xl border px-4 py-5 text-left transition ${
                        selected ? "border-2 border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <span className="block text-2xl" aria-hidden>
                        {venue.emoji}
                      </span>
                      <span className="mt-3 block text-base font-medium text-neutral-900">{venue.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "accessType" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                What type of place will refs work at?
              </h1>
              <div className="mt-8 space-y-3">
                {ACCESS_TYPES.map((option) => {
                  const selected = draft.accessType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ accessType: option.id })}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                        selected ? "border-2 border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{option.title}</p>
                        <p className="mt-1 text-sm text-neutral-500">{option.subtitle}</p>
                      </div>
                      <span className="text-2xl" aria-hidden>
                        {option.emoji}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "addressSearch" && (
            <div className="grid items-start gap-10 lg:grid-cols-2">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                  Set up your GotREFS listing
                </h1>
                <p className="mt-3 text-lg text-neutral-600">
                  It&apos;s easy to create a great listing—let&apos;s start with your address.
                </p>
                <div className="mt-8 flex items-center gap-3 rounded-full border border-neutral-300 bg-white px-5 py-4 shadow-sm">
                  <span className="text-neutral-500" aria-hidden>
                    🔍
                  </span>
                  <PlacesWhereInput
                    id="wizard-address"
                    value={searchQuery}
                    placeholder="Enter your address"
                    includedPrimaryTypes={[]}
                    onChange={setSearchQuery}
                    onPlaceSelect={(place) => {
                      if (!place) {
                        patch({ lat: null, lng: null });
                        return;
                      }
                      const parsed = parseUsAddress(place.label);
                      patch({ ...parsed, lat: place.lat, lng: place.lng, addressLabel: place.label });
                      setSearchQuery(place.label);
                      setScreen("confirmAddress");
                    }}
                    className="w-full border-0 bg-transparent p-0 text-base font-medium text-neutral-800 placeholder:text-neutral-400 outline-none"
                  />
                </div>
              </div>
              <div className="rounded-[2rem] bg-[#cfe0f5] p-8">
                <div className="mx-auto max-w-xs overflow-hidden rounded-3xl bg-white shadow-xl">
                  <div className={`aspect-[4/3] bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-5xl`}>
                    {visual.emoji}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-neutral-900">{previewTitle}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <p className="text-sm text-neutral-600">Hosted by {organizationName?.trim() || "you"}</p>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
                        {(organizationName || "Y").slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {screen === "confirmAddress" && (
            <div className="mx-auto max-w-lg">
              <h1 className="text-center text-2xl font-semibold text-neutral-900">Confirm your address</h1>
              <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-400">
                <AddressField label="Country / region" value={country} onChange={() => undefined} as="select" />
                <AddressField label="Street address" value={draft.street} onChange={(street) => patch({ street })} placeholder="Street address" />
                <AddressField label="Apt, suite, unit (if applicable)" value={draft.unit} onChange={(unit) => patch({ unit })} placeholder="Optional" />
                <AddressField label="City / town" value={draft.city} onChange={(city) => patch({ city })} />
                <AddressField label="State / territory" value={draft.state} onChange={(state) => patch({ state })} placeholder="California" />
                <AddressField label="ZIP code" value={draft.zip} onChange={(zip) => patch({ zip })} />
              </div>
            </div>
          )}

          {screen === "pinMap" && (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Is the pin in the right spot?
              </h1>
              <p className="mt-2 text-neutral-600">
                Your address is only shared with refs after they&apos;ve been booked.
              </p>
              <div className="mt-6">
                <VenuePinMap
                  center={{ lat: draft.lat ?? 34.05, lng: draft.lng ?? -118.25 }}
                  addressLabel={draft.addressLabel || draft.street}
                  onCenterChange={(coords) => patch({ lat: coords.lat, lng: coords.lng })}
                />
              </div>
            </div>
          )}

          {screen === "locationPrivacy" && (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Your exact address stays private
              </h1>
              <p className="mt-2 max-w-2xl text-neutral-600">
                We only share your address after refs book through GotREFS. Until then, they&apos;ll see an
                approximate location within about <strong>7 miles</strong> on the map — so they can&apos;t go
                around the platform to find you at a specific park or gym.
              </p>
              <div className="mt-6">
                <VenuePinMap
                  center={{ lat: draft.lat ?? 34.05, lng: draft.lng ?? -118.25 }}
                  addressLabel={draft.addressLabel || draft.street}
                  approximate
                  onCenterChange={(coords) => patch({ lat: coords.lat, lng: coords.lng })}
                />
              </div>
              <p className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-600">
                Precise pin and street address unlock for the hired refs once their booking is confirmed.
              </p>
            </div>
          )}

          {screen === "basics" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Share some basics about your event
              </h1>
              <p className="mt-2 text-neutral-500">You&apos;ll add more details later, like pay and timing.</p>
              <div className="mt-8">
                <StepperRow
                  label="Refs needed"
                  value={draft.officialsNeeded}
                  min={1}
                  onChange={(officialsNeeded) => patch({ officialsNeeded })}
                />
              </div>
            </div>
          )}

          {screen === "schedule" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                {quickRepost ? "Add another game" : "When is your event?"}
              </h1>
              <p className="mt-2 text-neutral-500">
                {quickRepost
                  ? `Same venue (${draft.city || "your city"}) · ${draft.sport || "sport"} · pay stays the same. Only set the new time.`
                  : "Refs see the date and time so they can match their availability."}
              </p>
              <div className="mt-8 space-y-4">
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Event name (optional)</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={draft.eventTitle}
                    onChange={(e) => patch({ eventTitle: e.target.value })}
                    placeholder="e.g. Varsity vs. Central High"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                    <span className="text-xs text-neutral-500">Starts</span>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
                      value={draft.eventStart}
                      onChange={(e) => patch({ eventStart: e.target.value })}
                    />
                  </label>
                  <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                    <span className="text-xs text-neutral-500">Ends (optional)</span>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
                      value={draft.eventEnd}
                      onChange={(e) => patch({ eventEnd: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {screen === "intro2" && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Step 2</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Make your event stand out
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  Tell refs the game level, sport, and anything they should know before they accept —
                  so the right officials show up prepared.
                </p>
              </div>
              <div className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.gradient}`}>
                <div className="flex aspect-[4/3] items-center justify-center text-7xl">{visual.emoji}</div>
              </div>
            </div>
          )}

          {screen === "gameLevel" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                What level are these games?
              </h1>
              <p className="mt-2 text-neutral-500">Helps the right refs find you — and know what to expect.</p>
              <div className="mt-8 space-y-3">
                {GAME_LEVELS.map((level) => {
                  const selected = draft.gameLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => patch({ gameLevel: level.id })}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                        selected
                          ? "border-2 border-neutral-900 bg-neutral-50"
                          : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{level.title}</p>
                        <p className="mt-1 text-sm text-neutral-500">{level.subtitle}</p>
                      </div>
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-neutral-900" : "border-neutral-300"
                        }`}
                      >
                        {selected ? <span className="h-3 w-3 rounded-full bg-neutral-900" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "sport" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">What sport is this for?</h1>
              <p className="mt-2 text-neutral-500">Pick a primary sport so the right refs find you.</p>
              <div className="mt-8">
                <SportsFields
                  primarySport={draft.sport}
                  onPrimaryChange={(sport) => patch({ sport })}
                  additionalSports={draft.additionalSports}
                  onAdditionalChange={(additionalSports) => patch({ additionalSports })}
                />
              </div>
            </div>
          )}

          {screen === "refInstructions" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Anything refs should know before they arrive?
              </h1>
              <p className="mt-2 text-neutral-500">
                Parking, check-in spot, locker rooms, dress code, gate codes — optional but helpful.
              </p>
              <textarea
                className="mt-8 min-h-40 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900"
                value={draft.refInstructions}
                onChange={(e) => patch({ refInstructions: e.target.value })}
                placeholder="e.g. Park in Lot B, check in at the front desk, black pants required…"
                maxLength={600}
              />
              <p className="mt-2 text-right text-xs text-neutral-500">{draft.refInstructions.length}/600</p>
            </div>
          )}

          {screen === "bio" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                Create your organization description
              </h1>
              <p className="mt-2 text-neutral-500">Share what refs should know about your league or school.</p>
              <textarea
                className="mt-8 min-h-40 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900"
                value={draft.bio}
                onChange={(e) => patch({ bio: e.target.value })}
                placeholder="Tell refs about your events, expectations, and vibe…"
                maxLength={800}
              />
              <p className="mt-2 text-right text-xs text-neutral-500">{draft.bio.length}/800</p>
            </div>
          )}

          {screen === "intro3" && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Step 3</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Finish up and publish
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  Finally, you&apos;ll set your pay, add boosts to stand out, and confirm a few final details to
                  publish your listing.
                </p>
              </div>
              <div className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.gradient}`}>
                <div className="flex aspect-[4/3] items-center justify-center text-7xl">{visual.emoji}</div>
              </div>
            </div>
          )}

          {screen === "prices" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Now, set your prices
              </h1>
              <p className="mt-2 text-neutral-500">
                These suggestions are based on ref demand for similar games in your area.
              </p>
              <div className="mt-8 space-y-3">
                <div className="flex gap-2">
                  {(["exact", "range"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => patch({ rateType: type })}
                      className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                        draft.rateType === type ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {draft.rateType === "exact" ? (
                  <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                    <span className="text-xs text-neutral-500">Base pay per official</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-neutral-900">$</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full border-0 bg-transparent p-0 text-3xl font-semibold text-neutral-900 outline-none"
                        value={draft.ratePerOfficial}
                        onChange={(e) => patch({ ratePerOfficial: e.target.value })}
                        placeholder="45"
                      />
                    </div>
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                      <span className="text-xs text-neutral-500">Min</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold">$</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none"
                          value={draft.rateMin}
                          onChange={(e) => patch({ rateMin: e.target.value })}
                        />
                      </div>
                    </label>
                    <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                      <span className="text-xs text-neutral-500">Max</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold">$</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none"
                          value={draft.rateMax}
                          onChange={(e) => patch({ rateMax: e.target.value })}
                        />
                      </div>
                    </label>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-300 px-5 py-4">
                  <div>
                    <p className="text-xs text-neutral-500">Weekend adjustment</p>
                    <p className="text-2xl font-semibold text-neutral-900">+11%</p>
                  </div>
                  <p className="text-sm text-neutral-500">
                    {basePrice > 0 ? `$${Math.round(basePrice * 1.11)} for Fri and Sat` : "Applies Fri and Sat"}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setSimilarOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-md hover:bg-neutral-50"
                >
                  <span className="text-[var(--red)]" aria-hidden>
                    📍
                  </span>
                  View similar listings
                </button>
              </div>
            </div>
          )}

          {screen === "discounts" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">Add boosts</h1>
              <p className="mt-2 text-neutral-500">
                Help your event stand out to get staffed faster and earn your first reviews.
              </p>
              <div className="mt-8 space-y-3">
                {DISCOUNT_OPTIONS.map((option) => {
                  const checked = draft.discounts.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        patch({
                          discounts: checked
                            ? draft.discounts.filter((id) => id !== option.id)
                            : [...draft.discounts, option.id],
                        })
                      }
                      className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                        checked ? "border-neutral-300 bg-neutral-50" : "border-neutral-300 bg-white hover:border-neutral-500"
                      }`}
                    >
                      <span
                        className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${
                          checked ? "bg-white ring-1 ring-neutral-300" : "bg-neutral-100"
                        }`}
                      >
                        {option.percentLabel}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-neutral-900">{option.title}</span>
                        <span className="mt-0.5 block text-sm text-neutral-500">{option.subtitle}</span>
                      </span>
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${
                          checked ? "bg-neutral-900" : "border border-neutral-300 bg-white"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "contact" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                How can refs and GotREFS reach you?
              </h1>
              <p className="mt-2 text-neutral-500">
                We use this to confirm your booking and keep you updated about your event.
              </p>
              <div className="mt-8 space-y-4">
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Your name</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={draft.contactName}
                    onChange={(e) => patch({ contactName: e.target.value })}
                    placeholder="First and last name"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Company or club name</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={draft.clubName}
                    onChange={(e) => patch({ clubName: e.target.value })}
                    placeholder="e.g. Riverside Youth Basketball League"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Email</span>
                  <input
                    type="email"
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={draft.contactEmail}
                    onChange={(e) => patch({ contactEmail: e.target.value })}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Phone number</span>
                  <input
                    type="tel"
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={draft.contactPhone}
                    onChange={(e) => patch({ contactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </label>
              </div>
            </div>
          )}

          {screen === "finalDetails" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Provide a few final details</h1>
              <p className="mt-2 text-neutral-500">
                This is required to comply with financial regulations and helps us prevent fraud.
              </p>

              <p className="mt-8 font-semibold text-neutral-900">What&apos;s your organization&apos;s address?</p>
              <p className="mt-1 text-sm text-neutral-500">Refs won&apos;t see this information.</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-400">
                <AddressField label="Country / region" value={country} onChange={() => undefined} as="select" />
                <AddressField
                  label="Street address"
                  value={draft.billingStreet}
                  onChange={(billingStreet) => patch({ billingStreet })}
                  placeholder="Street address"
                />
                <AddressField
                  label="Apt, suite, unit (if applicable)"
                  value={draft.billingUnit}
                  onChange={(billingUnit) => patch({ billingUnit })}
                  placeholder="Optional"
                />
                <AddressField label="City / town" value={draft.billingCity} onChange={(billingCity) => patch({ billingCity })} />
                <AddressField
                  label="State / territory"
                  value={draft.billingState}
                  onChange={(billingState) => patch({ billingState })}
                  placeholder="California"
                />
                <AddressField label="ZIP code" value={draft.billingZip} onChange={(billingZip) => patch({ billingZip })} />
              </div>

              <p className="mt-10 font-semibold text-neutral-900">Verify your organization</p>
              <p className="mt-1 text-sm text-neutral-500">
                Upload your face photo for your GotREFS ID card, a government ID or league credential, and your logo.
              </p>
              {idDocPath && logoPath ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <GreenCheck />
                  <div>
                    <p className="font-semibold text-emerald-900">Organization verified</p>
                    <p className="text-sm text-emerald-800">
                      ID and logo are on file
                      {avatarPath ? ", and your face photo is on your ID card" : ""}. You&apos;re ready to publish.
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {onUploadAvatar ? (
                  <label
                    className={`block rounded-2xl border p-5 transition ${
                      avatarPath ? "border-emerald-300 bg-emerald-50/40" : "border-neutral-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-neutral-900">Your face photo</p>
                      {avatarPath ? <GreenCheck size="sm" label="Face photo uploaded" /> : null}
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="mt-3 text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onUploadAvatar(file);
                      }}
                    />
                    {avatarPath ? (
                      <p className="mt-2 text-sm font-medium text-emerald-700">Photo will show on your GotREFS ID card</p>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-500">JPG, PNG, or WEBP</p>
                    )}
                  </label>
                ) : null}
                <label
                  className={`block rounded-2xl border p-5 transition ${
                    idDocPath ? "border-emerald-300 bg-emerald-50/40" : "border-neutral-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-neutral-900">Government ID or league credential</p>
                    {idDocPath ? <GreenCheck size="sm" label="Credential uploaded" /> : null}
                  </div>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="mt-3 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadId(file);
                    }}
                  />
                  {idDocPath ? (
                    <p className="mt-2 text-sm font-medium text-emerald-700">Credential uploaded</p>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">JPG, PNG, or PDF</p>
                  )}
                </label>
                <label
                  className={`block rounded-2xl border p-5 transition ${
                    logoPath ? "border-emerald-300 bg-emerald-50/40" : "border-neutral-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-neutral-900">Organization logo</p>
                    {logoPath ? <GreenCheck size="sm" label="Logo uploaded" /> : null}
                  </div>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.svg"
                    className="mt-3 text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadLogo(file);
                    }}
                  />
                  {logoPath ? (
                    <p className="mt-2 text-sm font-medium text-emerald-700">Logo uploaded</p>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">JPG, PNG, WEBP, or SVG</p>
                  )}
                </label>
              </div>
            </div>
          )}

          {screen === "done" && (
            <div className="mx-auto max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
                {quickRepost ? "Game posted" : "Your listing"}
              </h1>
              <p className="mt-2 text-neutral-500">
                Hosting a full weekend? Keep the same venue and post the next game in one step — or finish and manage
                everything from your dashboard (CSV bulk import is there too).
              </p>
              <div className="mt-6 max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-neutral-200">
                <div className="relative">
                  <div className={`aspect-[4/3] bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-6xl`}>
                    {visual.emoji}
                  </div>
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-neutral-800">
                    ● Posted
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-neutral-900">{previewTitle}</p>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    {draft.sport || "Sport"} · {draft.city || "Your city"}, {draft.state || "CA"}
                  </p>
                </div>
              </div>
              {payoutStage === null && (
                <div className="mt-8 flex max-w-sm flex-col gap-3">
                  <button
                    type="button"
                    onClick={startAnotherEvent}
                    className="w-full rounded-lg bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    Post another game at this venue
                  </button>
                  <button
                    type="button"
                    onClick={() => onComplete(draft)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-5 py-3.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                  >
                    Done — go to dashboard
                  </button>
                </div>
              )}
            </div>
          )}

          {error ? <p className="mx-auto mt-6 max-w-xl text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      </div>

      {/* Airbnb-style segmented black progress bar */}
      {screen !== "done" && (
        <footer className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
          <div className="mb-4 flex gap-1.5">
            {progress.map((fill, index) => (
              <div key={index} className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all duration-300"
                  style={{ width: `${Math.round(fill * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            {screen === "intro1" ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-neutral-900 underline underline-offset-2"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(saving)}
              onClick={() => void handleNext()}
              className="rounded-lg bg-neutral-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : nextLabel}
            </button>
          </div>
        </footer>
      )}

      {/* Similar listings map overlay — same page */}
      {similarOpen && (
        <div className="fixed inset-0 z-[60] bg-white" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close similar listings"
            onClick={() => setSimilarOpen(false)}
            className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md hover:bg-neutral-100"
          >
            ✕
          </button>
          <VenuePinMap
            center={{ lat: draft.lat ?? 34.05, lng: draft.lng ?? -118.25 }}
            approximate
            onCenterChange={() => undefined}
            className="h-full w-full"
          />
          <div className="absolute right-4 top-4 z-10 w-[min(92%,340px)] rounded-3xl bg-white p-6 shadow-xl">
            <p className="text-xl font-semibold text-neutral-900">Compare similar listings</p>
            <p className="mt-1 text-sm text-neutral-500">
              {draft.sport || "Sports"} games · {draft.officialsNeeded} ref{draft.officialsNeeded === 1 ? "" : "s"}
            </p>
            <p className="mt-4 font-semibold text-neutral-900">Booked games</p>
            <p className="mt-1 text-sm text-neutral-600">
              Most games staffed near you paid an average of ${similarLow} – ${similarHigh} per official.
            </p>
          </div>
          {basePrice > 0 ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <span className="rounded-full bg-[var(--red)] px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
                🏠 ${basePrice}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Payout flow — Airbnb-style step by step */}
      {payoutStage === "prompt" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <button
              type="button"
              aria-label="Skip payout for now"
              onClick={() => void finishPayout(true)}
              className="float-right -mr-3 -mt-3 text-lg text-neutral-500 hover:text-neutral-800"
            >
              ✕
            </button>
            <p className="text-sm text-neutral-500">Required to get set up</p>
            <p className="mt-6 text-5xl" aria-hidden>
              🪙
            </p>
            <h2 className="mt-6 text-2xl font-semibold text-neutral-900">Add a payout method</h2>
            <p className="mt-2 text-sm text-neutral-500">
              You&apos;ll be able to pay refs once you set up a payout method.
            </p>
            <button
              type="button"
              onClick={() => setPayoutStage("method")}
              className="mt-6 w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Add payout method
            </button>
          </div>
        </div>
      )}

      {(payoutStage === "method" || payoutStage === "holder" || payoutStage === "bank") && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white" role="dialog" aria-modal="true">
          <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-8">
            <p className="text-sm font-semibold tracking-tight text-neutral-900">gotrefs</p>
            <button
              type="button"
              onClick={() => void finishPayout(true)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Exit
            </button>
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-lg px-4 py-10">
              {payoutStage === "method" && (
                <>
                  <h2 className="text-center text-2xl font-semibold text-neutral-900">Let&apos;s add a payout method</h2>
                  <p className="mt-2 text-center text-sm text-neutral-500">
                    To start, let us know where you&apos;d like us to send your money.
                  </p>
                  <p className="mt-8 font-semibold text-neutral-900">Billing country/region</p>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-300">
                    <AddressField label="Billing country/region" value={country} onChange={() => undefined} as="select" />
                  </div>
                  <p className="mt-8 font-semibold text-neutral-900">How would you like to get paid?</p>
                  <p className="mt-1 text-sm text-neutral-500">Payouts will be sent in USD.</p>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-300">
                    {(
                      [
                        { id: "fastpay", title: "Fast Pay", bullets: ["Visa or Mastercard debit required", "30 minutes or less", "1.5% fee (maximum $15 USD)"], emoji: "💳" },
                        { id: "bank", title: "Bank account", bullets: ["3-5 business days", "No fees"], emoji: "🏦" },
                        { id: "paypal", title: "PayPal", bullets: ["1 business day", "PayPal fees may apply"], emoji: "🅿️" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPayoutMethod(option.id)}
                        className="flex w-full items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 text-left last:border-b-0 hover:bg-neutral-50"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl" aria-hidden>
                            {option.emoji}
                          </span>
                          <div>
                            <p className="font-semibold text-neutral-900">{option.title}</p>
                            <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                              {option.bullets.map((bullet) => (
                                <li key={bullet}>• {bullet}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <span
                          aria-hidden
                          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            payoutMethod === option.id ? "border-neutral-900" : "border-neutral-300"
                          }`}
                        >
                          {payoutMethod === option.id ? <span className="h-3 w-3 rounded-full bg-neutral-900" /> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {payoutStage === "holder" && (
                <>
                  <h2 className="text-center text-2xl font-semibold text-neutral-900">Add the bank account holder</h2>
                  <p className="mt-8 font-semibold text-neutral-900">Whose bank account is it?</p>
                  <select
                    className="mt-2 w-full rounded-xl border border-neutral-400 px-4 py-3 text-base text-neutral-900 outline-none"
                    value={payoutHolder}
                    onChange={(e) => setPayoutHolder(e.target.value)}
                  >
                    <option value="">Select one</option>
                    <option value={organizationName || "My organization"}>
                      {organizationName || "My organization"}
                    </option>
                    <option value="Me (personal account)">Me (personal account)</option>
                  </select>
                  <p className="mt-2 text-xs text-neutral-500">Choose from people on your organizer account.</p>
                </>
              )}

              {payoutStage === "bank" && (
                <>
                  <h2 className="text-center text-2xl font-semibold text-neutral-900">Add bank account info</h2>
                  <p className="mt-8 font-semibold text-neutral-900">Is this a checking or savings account?</p>
                  <div className="mt-3 space-y-2">
                    {(["checking", "savings"] as const).map((type) => (
                      <label key={type} className="flex items-center gap-3 text-base capitalize text-neutral-900">
                        <input
                          type="radio"
                          name="account-type"
                          checked={payoutAccountType === type}
                          onChange={() => setPayoutAccountType(type)}
                          className="h-5 w-5 accent-neutral-900"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                  <p className="mt-8 font-semibold text-neutral-900">Routing number</p>
                  <input
                    className="mt-2 w-full rounded-xl border border-neutral-400 px-4 py-3 text-base outline-none"
                    placeholder="Routing number"
                    inputMode="numeric"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Enter the routing number. It is located on the bottom left corner of a check or within account
                    details from the bank.
                  </p>
                  <p className="mt-6 font-semibold text-neutral-900">Account number</p>
                  <div className="mt-2 overflow-hidden rounded-xl border border-neutral-400">
                    <input
                      className="w-full border-b border-neutral-300 px-4 py-3 text-base outline-none"
                      placeholder="Account number"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                    <input
                      className="w-full px-4 py-3 text-base outline-none"
                      placeholder="Confirm account number"
                      inputMode="numeric"
                      value={accountNumberConfirm}
                      onChange={(e) => setAccountNumberConfirm(e.target.value)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Enter the account number. This can usually be found within the account details.
                  </p>
                </>
              )}

              {error ? <p className="mt-6 text-sm font-medium text-red-600">{error}</p> : null}
            </div>
          </div>
          <footer className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (payoutStage === "bank") setPayoutStage("holder");
                  else if (payoutStage === "holder") setPayoutStage("method");
                  else setPayoutStage("prompt");
                }}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-neutral-900 underline underline-offset-2"
              >
                Back
              </button>
              <button
                type="button"
                disabled={savingPayout}
                onClick={() => {
                  setError(null);
                  if (payoutStage === "method") {
                    if (!payoutMethod) {
                      setError("Choose how you'd like to get paid.");
                      return;
                    }
                    if (payoutMethod === "bank") setPayoutStage("holder");
                    else void finishPayout(false);
                    return;
                  }
                  if (payoutStage === "holder") {
                    if (!payoutHolder) {
                      setError("Select whose bank account this is.");
                      return;
                    }
                    setPayoutStage("bank");
                    return;
                  }
                  if (payoutStage === "bank") {
                    if (!payoutAccountType || !routingNumber.trim() || !accountNumber.trim()) {
                      setError("Fill in account type, routing number, and account number.");
                      return;
                    }
                    if (accountNumber !== accountNumberConfirm) {
                      setError("Account numbers do not match.");
                      return;
                    }
                    void finishPayout(false);
                  }
                }}
                className="rounded-lg bg-neutral-900 px-8 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {savingPayout ? "Saving…" : payoutStage === "bank" ? "Finish" : "Next"}
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
