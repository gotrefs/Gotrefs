"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ALL_SPORTS, OTHER_SPORT_VALUE } from "@/data/sports";
import { PasswordField } from "@/components/auth/PasswordField";
import { CertificationFields } from "@/components/CertificationFields";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { formatHourlyRateRange } from "@/lib/pay-range";
import { sportListingVisual } from "@/lib/marketplace/airbnb-styles";
import { sportEmoji } from "@/lib/sport-emoji";
import { saveRefSignupDraft } from "@/lib/auth/signup-draft";
import { RefGearDiscountTeaser } from "@/components/partners/RefGearCouponNotice";
import { BrandLogo } from "@/components/BrandLogo";

const SIGNUP_HOURLY_RATE_FLOOR = 10;
const SIGNUP_HOURLY_RATE_CEILING = 150;

const WORK_REGION_OPTIONS = [
  { id: "Local city", title: "Local city", subtitle: "Games in and around your home city.", emoji: "🏠" },
  { id: "County-wide", title: "County-wide", subtitle: "Willing to travel across the county.", emoji: "🗺️" },
  { id: "Statewide", title: "Statewide", subtitle: "Open to games across your state.", emoji: "📍" },
  {
    id: "Neighboring states",
    title: "Neighboring states",
    subtitle: "Happy to cross state lines for the right game.",
    emoji: "🚗",
  },
  {
    id: "Tournament travel",
    title: "Tournament travel",
    subtitle: "Weekend tournaments and multi-day events.",
    emoji: "✈️",
  },
] as const;

type WizardScreen =
  | "intro1"
  | "legalName"
  | "photo"
  | "primarySport"
  | "certificationLevel"
  | "hourlyRate"
  | "bio"
  | "intro2"
  | "govId"
  | "certDoc"
  | "intro3"
  | "baseCity"
  | "travelRadius"
  | "workRegions"
  | "account";

export type RefSignupWizardScreen = WizardScreen;

const STEP1_SCREENS: WizardScreen[] = [
  "intro1",
  "legalName",
  "photo",
  "primarySport",
  "certificationLevel",
  "hourlyRate",
  "bio",
];
const STEP2_SCREENS: WizardScreen[] = ["intro2", "govId", "certDoc"];
const STEP3_SCREENS: WizardScreen[] = [
  "intro3",
  "baseCity",
  "travelRadius",
  "workRegions",
  "account",
];
const ALL_SCREENS: WizardScreen[] = [...STEP1_SCREENS, ...STEP2_SCREENS, ...STEP3_SCREENS];

function normalizeWizardScreen(screen: string | undefined): WizardScreen {
  if (screen === "assignorRecommend") return "account";
  if (screen === "secondarySport") return "certificationLevel";
  if (screen && (ALL_SCREENS as string[]).includes(screen)) return screen as WizardScreen;
  return "intro1";
}

export type RefSignupAirbnbWizardProps = {
  loading: boolean;
  error: string | null;
  oauthMode?: boolean;
  firstName: string;
  lastName: string;
  photoFile: File | null;
  gotrefsId?: string;
  primarySport: string;
  customPrimarySport: string;
  additionalSports: string[];
  certificationLevel: string;
  additionalCertificationLevels: string[];
  certifiedBy: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  bio: string;
  govIdFrontFile: File | null;
  govIdBackFile: File | null;
  certDocFile: File | null;
  email: string;
  baseCity: string;
  travelRadius: string;
  workRegions: string[];
  password: string;
  termsAccepted: boolean;
  onFirstName: (value: string) => void;
  onLastName: (value: string) => void;
  onPhotoFile: (file: File | null) => void;
  onPrimarySport: (value: string) => void;
  onCustomPrimarySport: (value: string) => void;
  onAdditionalSports: (sports: string[]) => void;
  onCertificationLevel: (value: string) => void;
  onAdditionalCertificationLevels: (levels: string[]) => void;
  onCertifiedBy: (value: string) => void;
  onHourlyRateMin: (value: string) => void;
  onHourlyRateMax: (value: string) => void;
  onBio: (value: string) => void;
  onGovIdFrontFile: (file: File | null) => void;
  onGovIdBackFile: (file: File | null) => void;
  onCertDocFile: (file: File | null) => void;
  onEmail: (value: string) => void;
  onBaseCity: (value: string) => void;
  onTravelRadius: (value: string) => void;
  onToggleRegion: (region: string) => void;
  onPassword: (value: string) => void;
  onTermsAccepted: (value: boolean) => void;
  onSubmit: (event: FormEvent, options?: { skipAssignor?: boolean }) => void;
  onExit: (screen?: WizardScreen) => void;
  /** Resume at this screen after Save & exit. */
  initialScreen?: WizardScreen;
};

function FileUploadCard({
  title,
  subtitle,
  file,
  onFile,
  accept = ".jpg,.jpeg,.png,.pdf,.webp",
}: {
  title: string;
  subtitle: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
}) {
  const uploaded = Boolean(file);
  return (
    <label
      className={`relative flex cursor-pointer flex-col items-start overflow-hidden rounded-2xl border px-5 py-6 transition ${
        uploaded
          ? "border-2 border-green-500 bg-green-50"
          : "border border-neutral-300 hover:border-neutral-500"
      }`}
    >
      {uploaded ? (
        <span
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-lg font-black text-white shadow-md"
          aria-label="Uploaded"
        >
          ✓
        </span>
      ) : null}
      <span className="text-lg font-semibold text-neutral-900">{title}</span>
      <span className="mt-1 text-sm text-neutral-500">{subtitle}</span>
      {uploaded ? (
        <>
          <span className="mt-4 text-sm font-semibold text-green-800">Uploaded · {file!.name}</span>
          <span className="mt-1 text-xs text-green-700/80">Tap to replace</span>
        </>
      ) : (
        <span className="mt-4 text-sm font-semibold text-neutral-900 underline underline-offset-2">
          Choose file to upload
        </span>
      )}
      <input type="file" accept={accept} className="sr-only" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

/**
 * Airbnb-style full-screen referee signup — same chrome as OrganizerListingWizard,
 * with the existing ref onboarding questions split one screen at a time.
 */
export function RefSignupAirbnbWizard({
  loading,
  error,
  oauthMode = false,
  firstName,
  lastName,
  photoFile,
  gotrefsId,
  primarySport,
  customPrimarySport,
  additionalSports,
  certificationLevel,
  additionalCertificationLevels,
  certifiedBy,
  hourlyRateMin,
  hourlyRateMax,
  bio,
  govIdFrontFile,
  govIdBackFile,
  certDocFile,
  email,
  baseCity,
  travelRadius,
  workRegions,
  password,
  termsAccepted,
  onFirstName,
  onLastName,
  onPhotoFile,
  onPrimarySport,
  onCustomPrimarySport,
  onAdditionalSports,
  onCertificationLevel,
  onAdditionalCertificationLevels,
  onCertifiedBy,
  onHourlyRateMin,
  onHourlyRateMax,
  onBio,
  onGovIdFrontFile,
  onGovIdBackFile,
  onCertDocFile,
  onEmail,
  onBaseCity,
  onTravelRadius,
  onToggleRegion,
  onPassword,
  onTermsAccepted,
  onSubmit,
  onExit,
  initialScreen = "intro1",
}: RefSignupAirbnbWizardProps) {
  const fullName = [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const [screen, setScreen] = useState<WizardScreen>(normalizeWizardScreen(initialScreen));
  const [localError, setLocalError] = useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [savingExit, setSavingExit] = useState(false);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const visualSport =
    primarySport === OTHER_SPORT_VALUE ? customPrimarySport.trim() || "Basketball" : primarySport || "Basketball";
  const visual = sportListingVisual(visualSport);

  const progress = useMemo(() => {
    const idx1 = STEP1_SCREENS.indexOf(screen);
    const idx2 = STEP2_SCREENS.indexOf(screen);
    const idx3 = STEP3_SCREENS.indexOf(screen);
    if (idx1 >= 0) return [idx1 / STEP1_SCREENS.length, 0, 0];
    if (idx2 >= 0) return [1, idx2 / STEP2_SCREENS.length, 0];
    return [1, 1, Math.max(0, idx3) / STEP3_SCREENS.length];
  }, [screen]);

  const minVal = Number(hourlyRateMin) || SIGNUP_HOURLY_RATE_FLOOR;
  const maxVal = Number(hourlyRateMax) || SIGNUP_HOURLY_RATE_FLOOR;
  const span = SIGNUP_HOURLY_RATE_CEILING - SIGNUP_HOURLY_RATE_FLOOR;
  const leftPct = ((minVal - SIGNUP_HOURLY_RATE_FLOOR) / span) * 100;
  const rightPct = ((maxVal - SIGNUP_HOURLY_RATE_FLOOR) / span) * 100;

  function setMin(raw: string) {
    const next = Math.min(Number(raw), maxVal);
    onHourlyRateMin(String(Math.max(SIGNUP_HOURLY_RATE_FLOOR, next)));
  }

  function setMax(raw: string) {
    const next = Math.max(Number(raw), minVal);
    onHourlyRateMax(String(Math.min(SIGNUP_HOURLY_RATE_CEILING, next)));
  }

  function goBack() {
    setLocalError(null);
    const idx = ALL_SCREENS.indexOf(screen);
    if (idx <= 0) {
      onExit(screen);
      return;
    }
    setScreen(ALL_SCREENS[idx - 1]);
  }

  function goNext() {
    setLocalError(null);
    const idx = ALL_SCREENS.indexOf(screen);
    if (idx < ALL_SCREENS.length - 1) setScreen(ALL_SCREENS[idx + 1]);
  }

  async function handleSaveAndExit() {
    setSavingExit(true);
    setLocalError(null);
    try {
      await saveRefSignupDraft(
        {
          screen,
          fullName,
          firstName,
          lastName,
          email,
          primarySport,
          customPrimarySport,
          secondarySport: additionalSports[0] || "",
          additionalSports,
          certificationLevel,
          additionalCertificationLevels,
          certifiedBy,
          hourlyRateMin,
          hourlyRateMax,
          bio,
          baseCity,
          travelRadius,
          workRegions,
          termsAccepted,
          recommendedAssignorName: "",
          recommendedAssignorEmail: "",
          recommendedAssignorPhone: "",
        },
        {
          photo: photoFile,
          govIdFront: govIdFrontFile,
          govIdBack: govIdBackFile,
          certDoc: certDocFile,
        }
      );
      onExit(screen);
    } catch {
      setLocalError("Could not save your progress. Try again.");
    } finally {
      setSavingExit(false);
    }
  }

  const canContinue = (() => {
    if (screen === "legalName") return Boolean(firstName.trim() && lastName.trim());
    if (screen === "photo") return Boolean(photoFile);
    if (screen === "primarySport") {
      if (!primarySport.trim()) return false;
      if (primarySport === OTHER_SPORT_VALUE && !customPrimarySport.trim()) return false;
      return true;
    }
    if (screen === "certificationLevel") return Boolean(certificationLevel.trim());
    if (screen === "hourlyRate") {
      return (
        Number.isFinite(minVal) &&
        minVal >= SIGNUP_HOURLY_RATE_FLOOR &&
        Number.isFinite(maxVal) &&
        maxVal >= minVal &&
        maxVal <= SIGNUP_HOURLY_RATE_CEILING
      );
    }
    if (screen === "bio") return true; // optional — organizers benefit from it, but signup can continue
    if (screen === "govId") return Boolean(govIdFrontFile && govIdBackFile);
    if (screen === "certDoc") return Boolean(certDocFile);
    if (screen === "baseCity") return Boolean(baseCity.trim());
    if (screen === "account") {
      const emailOk = Boolean(email.trim() && email.includes("@"));
      const passwordOk = oauthMode || password.trim().length >= 8;
      return emailOk && passwordOk && termsAccepted && !loading;
    }
    return true;
  })();

  function handleNext() {
    setLocalError(null);
    if (!canContinue) {
      if (screen === "legalName") setLocalError("Enter your first and last name to continue.");
      else if (screen === "photo") setLocalError("Upload a clear photo of your face to continue.");
      else if (screen === "primarySport") setLocalError("Pick at least one sport you officiate.");
      else if (screen === "certificationLevel") setLocalError("Add at least one certification to continue.");
      else if (screen === "bio") {
        // Bio is optional; keep this branch unused but safe if validation changes.
        setLocalError(null);
      }
      else if (screen === "govId") setLocalError("Upload both the front and back of your government ID to continue.");
      else if (screen === "certDoc") setLocalError("Upload your certification or license document to continue.");
      else if (screen === "baseCity") setLocalError("Enter your base city.");
      else if (screen === "account") {
        if (!email.trim() || !email.includes("@")) setLocalError("Enter a valid email address.");
        else if (!oauthMode && password.trim().length < 8) setLocalError("Create a password with at least 8 characters.");
        else if (!termsAccepted) setLocalError("Please accept the GotRefs terms to continue.");
      }
      return;
    }
    if (screen === "account") {
      onSubmit(new Event("submit") as unknown as FormEvent, { skipAssignor: true });
      return;
    }
    goNext();
  }

  const nextLabel =
    screen === "intro1" || screen === "intro2" || screen === "intro3"
      ? "Get started"
      : screen === "account"
        ? loading
          ? "Saving…"
          : oauthMode
            ? "Finish setup"
            : "Create account"
        : "Next";

  const displayError = screen === "account" ? localError || error : localError;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 sm:px-8">
        <BrandLogo
          href="/"
          src="/gotrefs-logo-blue-background.png"
          imageClassName="h-10 w-auto sm:h-12"
          priority
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Questions?
          </button>
          <button
            type="button"
            disabled={savingExit}
            onClick={() => void handleSaveAndExit()}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {savingExit ? "Saving…" : "Save & exit"}
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
                  Tell us about yourself
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  In this step, we&apos;ll ask for your name, photo, sports, certification level, and the hourly
                  rate range you want to earn.
                </p>
              </div>
              <div className="overflow-hidden rounded-[2rem] bg-[#dbe7f3]">
                <div className={`flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${visual.gradient} text-7xl`}>
                  {visual.emoji}
                </div>
              </div>
            </div>
          )}

          {screen === "legalName" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                What&apos;s your name?
              </h1>
              <p className="mt-2 text-neutral-500">
                Use your legal first and last name as they appear on your ID.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">First name</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={firstName}
                    onChange={(event) => onFirstName(event.target.value)}
                    placeholder="First"
                    autoComplete="given-name"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Last name</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={lastName}
                    onChange={(event) => onLastName(event.target.value)}
                    placeholder="Last"
                    autoComplete="family-name"
                  />
                </label>
              </div>
            </div>
          )}

          {screen === "photo" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Add a profile photo of your face
              </h1>
              <p className="mt-2 text-neutral-500">
                Required for your GotRefs ID card. Use a clear, forward-facing photo of yourself — it appears on
                your card as soon as you upload it.
              </p>
              <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
                <label
                  className={`relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border px-5 py-5 transition ${
                    photoFile
                      ? "border-2 border-green-500 bg-green-50"
                      : "border border-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  {photoFile ? (
                    <span
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-green-500 text-base font-black text-white shadow-md"
                      aria-label="Uploaded"
                    >
                      ✓
                    </span>
                  ) : null}
                  <span
                    className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${
                      photoFile ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {photoPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "Photo"
                    )}
                    {photoFile ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-2xl font-black text-white">
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-neutral-900">
                      {photoFile ? `Uploaded · ${photoFile.name}` : "Upload a face photo"}
                    </span>
                    <span className="mt-1 block text-sm text-neutral-500">
                      {photoFile ? "Tap to replace anytime." : "You can't continue without this photo."}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      setLocalError(null);
                      onPhotoFile(file);
                    }}
                  />
                </label>

                <div className="mx-auto w-full max-w-[400px]">
                  <p className="mb-3 text-center text-sm font-semibold text-neutral-600">Your GotRefs ID card</p>
                  <RefereeIdCard
                    fullName={fullName}
                    gotrefsId={gotrefsId}
                    avatarUrl={photoPreviewUrl ?? undefined}
                    avatarLabel={
                      fullName
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? "")
                        .join("") || "REF"
                    }
                    primarySport={
                      primarySport === OTHER_SPORT_VALUE
                        ? customPrimarySport.trim() || undefined
                        : primarySport || undefined
                    }
                    additionalSports={additionalSports}
                    certificationLevel={certificationLevel || undefined}
                    additionalCertificationLevels={additionalCertificationLevels}
                    certifiedBy={certifiedBy || certificationLevel || undefined}
                    baseCity={baseCity || undefined}
                    emptyPlaceholders
                    onUploadPhoto={(file) => {
                      setLocalError(null);
                      onPhotoFile(file);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {screen === "primarySport" && (
            <div>
              <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Which sports do you officiate?
              </h1>
              <p className="mx-auto mt-2 max-w-xl text-center text-neutral-500">
                Select all that apply. Your first pick is your primary sport.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ALL_SPORTS.map((sport) => {
                  const selectedList = [
                    primarySport,
                    ...additionalSports.filter((item) => item && item !== primarySport),
                  ].filter(Boolean);
                  const selected = selectedList.includes(sport);
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => {
                        const current = [
                          primarySport,
                          ...additionalSports.filter((item) => item && item !== primarySport),
                        ].filter(Boolean);
                        let next: string[];
                        if (current.includes(sport)) {
                          next = current.filter((item) => item !== sport);
                        } else {
                          next = [...current, sport];
                        }
                        if (next.length === 0) {
                          onPrimarySport("");
                          onAdditionalSports([]);
                          onCustomPrimarySport("");
                          return;
                        }
                        const [first, ...rest] = next;
                        onPrimarySport(first);
                        onAdditionalSports(rest.filter((item) => item !== OTHER_SPORT_VALUE));
                        if (first !== OTHER_SPORT_VALUE) onCustomPrimarySport("");
                      }}
                      className={`rounded-2xl border px-4 py-5 text-left transition ${
                        selected ? "border-2 border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <span className="block text-2xl" aria-hidden>
                        {sportEmoji(sport)}
                      </span>
                      <span className="mt-3 block text-base font-medium text-neutral-900">{sport}</span>
                      {selected ? (
                        <span className="mt-2 block text-xs font-semibold text-neutral-600">
                          {primarySport === sport ? "Primary · selected" : "Selected"}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const current = [
                      primarySport,
                      ...additionalSports.filter((item) => item && item !== primarySport),
                    ].filter(Boolean);
                    if (current.includes(OTHER_SPORT_VALUE)) {
                      const next = current.filter((item) => item !== OTHER_SPORT_VALUE);
                      if (next.length === 0) {
                        onPrimarySport("");
                        onAdditionalSports([]);
                        onCustomPrimarySport("");
                        return;
                      }
                      onPrimarySport(next[0]);
                      onAdditionalSports(next.slice(1));
                      onCustomPrimarySport("");
                      return;
                    }
                    onPrimarySport(OTHER_SPORT_VALUE);
                    onAdditionalSports(current.filter((item) => item !== OTHER_SPORT_VALUE));
                  }}
                  className={`rounded-2xl border px-4 py-5 text-left transition ${
                    primarySport === OTHER_SPORT_VALUE
                      ? "border-2 border-neutral-900 bg-neutral-50"
                      : "border-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <span className="block text-2xl" aria-hidden>
                    🏅
                  </span>
                  <span className="mt-3 block text-base font-medium text-neutral-900">Other</span>
                </button>
              </div>
              {primarySport === OTHER_SPORT_VALUE ? (
                <label className="mx-auto mt-6 block max-w-xl rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Type your primary sport</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={customPrimarySport}
                    onChange={(event) => onCustomPrimarySport(event.target.value)}
                    placeholder="e.g. Dodgeball"
                  />
                </label>
              ) : null}
            </div>
          )}

          {screen === "certificationLevel" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Where were you certified?
              </h1>
              <p className="mt-2 text-neutral-500">
                Add every certification level and association that applies. These show on your GotRefs ID for
                organizers.
              </p>
              <CertificationFields
                variant="airbnb"
                certificationLevel={certificationLevel}
                additionalCertificationLevels={additionalCertificationLevels}
                onCertificationLevel={onCertificationLevel}
                onAdditionalChange={onAdditionalCertificationLevels}
                certifiedBy={certifiedBy}
                onCertifiedBy={onCertifiedBy}
              />
            </div>
          )}

          {screen === "hourlyRate" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Now, set your hourly rate range
              </h1>
              <p className="mt-2 text-neutral-500">
                Drag both ends of the slider. Event organizers only see your GotRefs ID until you accept a game.
              </p>
              <div className="mt-8 rounded-2xl border border-neutral-300 bg-neutral-50 p-5">
                <p className="text-xl font-semibold text-neutral-900">{formatHourlyRateRange(minVal, maxVal)}</p>
                <div className="dual-range relative mt-6 h-8">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-200" />
                  <div
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-900"
                    style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
                  />
                  <input
                    type="range"
                    min={SIGNUP_HOURLY_RATE_FLOOR}
                    max={SIGNUP_HOURLY_RATE_CEILING}
                    step={5}
                    value={minVal}
                    onChange={(event) => setMin(event.target.value)}
                    aria-label="Minimum hourly rate"
                  />
                  <input
                    type="range"
                    min={SIGNUP_HOURLY_RATE_FLOOR}
                    max={SIGNUP_HOURLY_RATE_CEILING}
                    step={5}
                    value={maxVal}
                    onChange={(event) => setMax(event.target.value)}
                    aria-label="Maximum hourly rate"
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-neutral-500">
                  <span>${SIGNUP_HOURLY_RATE_FLOOR}/hr</span>
                  <span>
                    ${minVal} – ${maxVal}/hr
                  </span>
                  <span>${SIGNUP_HOURLY_RATE_CEILING}/hr</span>
                </div>
              </div>
            </div>
          )}

          {screen === "bio" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Tell organizers about your experience
              </h1>
              <p className="mt-2 text-neutral-500">
                Optional — share anything that helps hosts trust you: years officiating, leagues, championships, or
                sports you specialize in. You can skip this and continue.
              </p>
              <textarea
                className="mt-8 min-h-40 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-900"
                value={bio}
                onChange={(event) => onBio(event.target.value.slice(0, 800))}
                placeholder="Example: I've been a CIF referee for 30 years and have worked multiple CIF championships across basketball and football."
                maxLength={800}
                rows={6}
              />
              <p className="mt-2 text-right text-xs text-neutral-500">{bio.length}/800</p>
            </div>
          )}

          {screen === "intro2" && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Step 2</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Verify you&apos;re ready to ref
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  Upload your government ID and certification so organizers know you&apos;re a qualified official.
                </p>
              </div>
              <div className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.gradient}`}>
                <div className="flex aspect-[4/3] items-center justify-center text-7xl">📄</div>
              </div>
            </div>
          )}

          {screen === "govId" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Upload your government ID
              </h1>
              <p className="mt-2 text-neutral-500">
                We need a clear photo or scan of both the front and back before you can continue.
              </p>
              <div className="mt-8 space-y-3">
                <FileUploadCard
                  title="Government ID — front"
                  subtitle="Driver's license, passport, or state ID"
                  file={govIdFrontFile}
                  onFile={(file) => {
                    setLocalError(null);
                    onGovIdFrontFile(file);
                  }}
                />
                <FileUploadCard
                  title="Government ID — back"
                  subtitle="Make sure all text is readable"
                  file={govIdBackFile}
                  onFile={(file) => {
                    setLocalError(null);
                    onGovIdBackFile(file);
                  }}
                />
              </div>
            </div>
          )}

          {screen === "certDoc" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Add your certification or license
              </h1>
              <p className="mt-2 text-neutral-500">NFHS card, state license, USSF badge, or similar credential.</p>
              <div className="mt-8">
                <FileUploadCard
                  title="Certification / license document"
                  subtitle="PDF or photo of your credential"
                  file={certDocFile}
                  onFile={(file) => {
                    setLocalError(null);
                    onCertDocFile(file);
                  }}
                />
              </div>
            </div>
          )}

          {screen === "intro3" && (
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="text-sm text-neutral-500">Step 3</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Finish up and create your account
                </h1>
                <p className="mt-4 max-w-md text-lg text-neutral-600">
                  Set where you work, your travel radius, and create your password so you can start finding games.
                </p>
              </div>
              <div className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.gradient}`}>
                <div className="flex aspect-[4/3] items-center justify-center text-7xl">📍</div>
              </div>
            </div>
          )}

          {screen === "baseCity" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Where are you based?
              </h1>
              <p className="mt-2 text-neutral-500">Organizers use this to match you with nearby games.</p>
              <label className="mt-8 block rounded-2xl border border-neutral-300 px-5 py-4">
                <span className="text-xs text-neutral-500">Base city</span>
                <input
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                  value={baseCity}
                  onChange={(event) => onBaseCity(event.target.value)}
                  placeholder="Phoenix, AZ"
                />
              </label>
            </div>
          )}

          {screen === "travelRadius" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                How far are you willing to travel?
              </h1>
              <p className="mt-2 text-neutral-500">Set a radius from your base city.</p>
              <div className="mt-8 rounded-2xl border border-neutral-300 px-5 py-6">
                <p className="text-3xl font-semibold text-neutral-900">{travelRadius || 0} miles</p>
                <input
                  type="range"
                  min={5}
                  max={150}
                  value={travelRadius}
                  onChange={(event) => onTravelRadius(event.target.value)}
                  className="mt-6 w-full"
                />
                <div className="mt-2 flex justify-between text-xs font-semibold text-neutral-500">
                  <span>5 mi</span>
                  <span>150 mi</span>
                </div>
              </div>
            </div>
          )}

          {screen === "workRegions" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Where are you willing to work?
              </h1>
              <p className="mt-2 text-neutral-500">Select all that apply.</p>
              <div className="mt-8 space-y-3">
                {WORK_REGION_OPTIONS.map((option) => {
                  const selected = workRegions.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onToggleRegion(option.id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                        selected
                          ? "border-2 border-neutral-900 bg-neutral-50"
                          : "border-neutral-300 hover:border-neutral-500"
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

          {screen === "account" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Create your GotRefs account
              </h1>
              <p className="mt-2 text-neutral-500">Confirm your email, set a password, and agree to the terms.</p>
              <div className="mt-8 space-y-4">
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Email</span>
                  <input
                    type="email"
                    required
                    readOnly={oauthMode}
                    className={`mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none ${
                      oauthMode ? "text-neutral-500" : ""
                    }`}
                    value={email}
                    onChange={(event) => onEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
                {!oauthMode ? (
                  <PasswordField
                    label="Create password"
                    value={password}
                    onChange={(event) => onPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters, with a letter and number"
                    labelClassName="block text-sm font-semibold text-neutral-900"
                    inputClassName="w-full rounded-2xl border border-neutral-300 bg-white py-3.5 pl-4 pr-14 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                  />
                ) : null}
                <label className="flex items-start gap-3 rounded-2xl border border-neutral-300 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => onTermsAccepted(event.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span>
                    I have read and agree to the{" "}
                    <a
                      href="/policies/referee-official-terms"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-neutral-900 underline"
                    >
                      Referee & Official Terms & Conditions
                    </a>
                    ,{" "}
                    <a
                      href="/policies/privacy-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-neutral-900 underline"
                    >
                      Privacy Policy
                    </a>
                    ,{" "}
                    <a
                      href="/policies/payment-fee-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-neutral-900 underline"
                    >
                      Payment & Fee Policy
                    </a>
                    , and{" "}
                    <a
                      href="/policies/community-standards"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-neutral-900 underline"
                    >
                      Community Standards
                    </a>
                    .
                  </span>
                </label>
              </div>
              <div className="mt-8">
                <RefGearDiscountTeaser />
              </div>
            </div>
          )}

          {displayError ? (
            <p className="mx-auto mt-6 max-w-xl text-sm font-medium text-red-600">{displayError}</p>
          ) : null}
        </div>
      </div>

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
            disabled={!canContinue}
            onClick={() => handleNext()}
            className="rounded-lg bg-neutral-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {nextLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
