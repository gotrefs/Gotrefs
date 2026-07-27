"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ALL_SPORTS, OTHER_SPORT_VALUE } from "@/data/sports";
import { PasswordField } from "@/components/auth/PasswordField";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { formatHourlyRateRange } from "@/lib/pay-range";
import { sportListingVisual } from "@/lib/marketplace/airbnb-styles";
import { sportEmoji } from "@/lib/sport-emoji";
import { saveRefSignupDraft } from "@/lib/auth/signup-draft";

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
  | "secondarySport"
  | "certificationLevel"
  | "hourlyRate"
  | "intro2"
  | "govId"
  | "certDoc"
  | "intro3"
  | "baseCity"
  | "travelRadius"
  | "workRegions"
  | "account"
  | "assignorRecommend";

export type RefSignupWizardScreen = WizardScreen;

const STEP1_SCREENS: WizardScreen[] = [
  "intro1",
  "legalName",
  "photo",
  "primarySport",
  "secondarySport",
  "certificationLevel",
  "hourlyRate",
];
const STEP2_SCREENS: WizardScreen[] = ["intro2", "govId", "certDoc"];
const STEP3_SCREENS: WizardScreen[] = [
  "intro3",
  "baseCity",
  "travelRadius",
  "workRegions",
  "account",
  "assignorRecommend",
];
const ALL_SCREENS: WizardScreen[] = [...STEP1_SCREENS, ...STEP2_SCREENS, ...STEP3_SCREENS];

export type RefSignupAirbnbWizardProps = {
  loading: boolean;
  error: string | null;
  oauthMode?: boolean;
  fullName: string;
  photoFile: File | null;
  gotrefsId?: string;
  primarySport: string;
  customPrimarySport: string;
  secondarySport: string;
  certificationLevel: string;
  certifiedBy: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  govIdFrontFile: File | null;
  govIdBackFile: File | null;
  certDocFile: File | null;
  email: string;
  baseCity: string;
  travelRadius: string;
  workRegions: string[];
  password: string;
  termsAccepted: boolean;
  recommendedAssignorName: string;
  recommendedAssignorEmail: string;
  recommendedAssignorPhone: string;
  onFullName: (value: string) => void;
  onPhotoFile: (file: File | null) => void;
  onPrimarySport: (value: string) => void;
  onCustomPrimarySport: (value: string) => void;
  onSecondarySport: (value: string) => void;
  onCertificationLevel: (value: string) => void;
  onCertifiedBy: (value: string) => void;
  onHourlyRateMin: (value: string) => void;
  onHourlyRateMax: (value: string) => void;
  onGovIdFrontFile: (file: File | null) => void;
  onGovIdBackFile: (file: File | null) => void;
  onCertDocFile: (file: File | null) => void;
  onEmail: (value: string) => void;
  onBaseCity: (value: string) => void;
  onTravelRadius: (value: string) => void;
  onToggleRegion: (region: string) => void;
  onPassword: (value: string) => void;
  onTermsAccepted: (value: boolean) => void;
  onRecommendedAssignorName: (value: string) => void;
  onRecommendedAssignorEmail: (value: string) => void;
  onRecommendedAssignorPhone: (value: string) => void;
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
  fullName,
  photoFile,
  gotrefsId,
  primarySport,
  customPrimarySport,
  secondarySport,
  certificationLevel,
  certifiedBy,
  hourlyRateMin,
  hourlyRateMax,
  govIdFrontFile,
  govIdBackFile,
  certDocFile,
  email,
  baseCity,
  travelRadius,
  workRegions,
  password,
  termsAccepted,
  recommendedAssignorName,
  recommendedAssignorEmail,
  recommendedAssignorPhone,
  onFullName,
  onPhotoFile,
  onPrimarySport,
  onCustomPrimarySport,
  onSecondarySport,
  onCertificationLevel,
  onCertifiedBy,
  onHourlyRateMin,
  onHourlyRateMax,
  onGovIdFrontFile,
  onGovIdBackFile,
  onCertDocFile,
  onEmail,
  onBaseCity,
  onTravelRadius,
  onToggleRegion,
  onPassword,
  onTermsAccepted,
  onRecommendedAssignorName,
  onRecommendedAssignorEmail,
  onRecommendedAssignorPhone,
  onSubmit,
  onExit,
  initialScreen = "intro1",
}: RefSignupAirbnbWizardProps) {
  const [screen, setScreen] = useState<WizardScreen>(
    ALL_SCREENS.includes(initialScreen) ? initialScreen : "intro1"
  );
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
          email,
          primarySport,
          customPrimarySport,
          secondarySport,
          certificationLevel,
          hourlyRateMin,
          hourlyRateMax,
          baseCity,
          travelRadius,
          workRegions,
          termsAccepted,
          recommendedAssignorName,
          recommendedAssignorEmail,
          recommendedAssignorPhone,
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
    if (screen === "legalName") return Boolean(fullName.trim());
    if (screen === "photo") return Boolean(photoFile);
    if (screen === "primarySport") {
      if (!primarySport.trim()) return false;
      if (primarySport === OTHER_SPORT_VALUE && !customPrimarySport.trim()) return false;
      return true;
    }
    if (screen === "hourlyRate") {
      return (
        Number.isFinite(minVal) &&
        minVal >= SIGNUP_HOURLY_RATE_FLOOR &&
        Number.isFinite(maxVal) &&
        maxVal >= minVal &&
        maxVal <= SIGNUP_HOURLY_RATE_CEILING
      );
    }
    if (screen === "govId") return Boolean(govIdFrontFile && govIdBackFile);
    if (screen === "certDoc") return Boolean(certDocFile);
    if (screen === "baseCity") return Boolean(baseCity.trim());
    if (screen === "account") {
      const emailOk = Boolean(email.trim() && email.includes("@"));
      const passwordOk = oauthMode || password.trim().length >= 8;
      return emailOk && passwordOk && termsAccepted && !loading;
    }
    if (screen === "assignorRecommend") return !loading;
    return true;
  })();

  function assignorFieldsValid(): boolean {
    const name = recommendedAssignorName.trim();
    const emailValue = recommendedAssignorEmail.trim();
    const phone = recommendedAssignorPhone.trim();
    const anyFilled = Boolean(name || emailValue || phone);
    if (!anyFilled) return true;
    return Boolean(name && (emailValue || phone));
  }

  function handleNext() {
    setLocalError(null);
    if (!canContinue) {
      if (screen === "legalName") setLocalError("Enter your name to continue.");
      else if (screen === "photo") setLocalError("Upload a clear photo of your face to continue.");
      else if (screen === "primarySport") setLocalError("Pick the sport you primarily officiate.");
      else if (screen === "govId") setLocalError("Upload both the front and back of your government ID to continue.");
      else if (screen === "certDoc") setLocalError("Upload your certification or license document to continue.");
      else if (screen === "baseCity") setLocalError("Enter your base city.");
      else if (screen === "account") {
        if (!email.trim() || !email.includes("@")) setLocalError("Enter a valid email address.");
        else if (!oauthMode && password.trim().length < 8) setLocalError("Create a password with at least 8 characters.");
        else if (!termsAccepted) setLocalError("Please accept the GotREFS terms to continue.");
      }
      return;
    }
    if (screen === "assignorRecommend") return;
    goNext();
  }

  function submitAssignor(event: FormEvent, options?: { skip?: boolean }) {
    setLocalError(null);
    if (!options?.skip && !assignorFieldsValid()) {
      setLocalError("Enter the assignor's name and their email or phone number.");
      return;
    }
    onSubmit(event, options?.skip ? { skipAssignor: true } : undefined);
  }

  const nextLabel =
    screen === "intro1" || screen === "intro2" || screen === "intro3"
      ? "Get started"
      : screen === "assignorRecommend"
        ? loading
          ? "Saving…"
          : oauthMode
            ? "Finish setup"
            : "Create account"
        : "Next";

  const displayError =
    screen === "account" || screen === "assignorRecommend" ? localError || error : localError;

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
              <p className="mt-2 text-neutral-500">First name, last name, or both — whichever you go by.</p>
              <label className="mt-8 block rounded-2xl border border-neutral-300 px-5 py-4">
                <span className="text-xs text-neutral-500">Name</span>
                <input
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                  value={fullName}
                  onChange={(event) => onFullName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            </div>
          )}

          {screen === "photo" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Add a profile photo of your face
              </h1>
              <p className="mt-2 text-neutral-500">
                Required for your GotREFS ID card. Use a clear, forward-facing photo of yourself — it appears on
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
                      setLocalError(null);
                      onPhotoFile(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>

                <div className="mx-auto w-full max-w-[400px]">
                  <p className="mb-3 text-center text-sm font-semibold text-neutral-600">Your GotREFS ID card</p>
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
                    additionalSports={secondarySport ? [secondarySport] : []}
                    certificationLevel={certificationLevel || undefined}
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
                Which sport do you primarily officiate?
              </h1>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ALL_SPORTS.map((sport) => {
                  const selected = primarySport === sport;
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => {
                        onPrimarySport(sport);
                        onCustomPrimarySport("");
                        if (secondarySport === sport) onSecondarySport("");
                      }}
                      className={`rounded-2xl border px-4 py-5 text-left transition ${
                        selected ? "border-2 border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <span className="block text-2xl" aria-hidden>
                        {sportEmoji(sport)}
                      </span>
                      <span className="mt-3 block text-base font-medium text-neutral-900">{sport}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => onPrimarySport(OTHER_SPORT_VALUE)}
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
                  <span className="text-xs text-neutral-500">Type your sport</span>
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

          {screen === "secondarySport" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Do you officiate a second sport?
              </h1>
              <p className="mt-2 text-neutral-500">Optional — skip if you only work one sport.</p>
              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => onSecondarySport("")}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                    !secondarySport
                      ? "border-2 border-neutral-900 bg-neutral-50"
                      : "border-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <div>
                    <p className="text-lg font-semibold text-neutral-900">Primary sport only</p>
                    <p className="mt-1 text-sm text-neutral-500">I&apos;ll stick with one sport for now.</p>
                  </div>
                  <span className="text-2xl" aria-hidden>
                    ✓
                  </span>
                </button>
                {ALL_SPORTS.filter((sport) => sport !== primarySport).map((sport) => {
                  const selected = secondarySport === sport;
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => onSecondarySport(sport)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                        selected
                          ? "border-2 border-neutral-900 bg-neutral-50"
                          : "border-neutral-300 hover:border-neutral-500"
                      }`}
                    >
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{sport}</p>
                        <p className="mt-1 text-sm text-neutral-500">Also add this to your profile.</p>
                      </div>
                      <span className="text-2xl" aria-hidden>
                        {sportEmoji(sport)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {screen === "certificationLevel" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Where were you certified?
              </h1>
              <p className="mt-2 text-neutral-500">
                This shows on your GotREFS ID card under &quot;Accepted by&quot; for organizers.
              </p>
              <label className="mt-8 block rounded-2xl border border-neutral-300 px-5 py-4">
                <span className="text-xs text-neutral-500">Certified by / association</span>
                <input
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                  value={certifiedBy}
                  onChange={(event) => onCertifiedBy(event.target.value)}
                  placeholder="NFHS, state association, local association, USSF, etc."
                />
              </label>
              <label className="mt-4 block rounded-2xl border border-neutral-300 px-5 py-4">
                <span className="text-xs text-neutral-500">Certification level</span>
                <input
                  className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                  value={certificationLevel}
                  onChange={(event) => onCertificationLevel(event.target.value)}
                  placeholder="Youth, varsity, Grade 7, etc."
                />
              </label>
            </div>
          )}

          {screen === "hourlyRate" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Now, set your hourly rate range
              </h1>
              <p className="mt-2 text-neutral-500">
                Drag both ends of the slider. Event organizers only see your GotREFS ID until you accept a game.
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
                Create your GotREFS account
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
            </div>
          )}

          {screen === "assignorRecommend" && (
            <div className="mx-auto max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
                Recommended by an assignor?
              </h1>
              <p className="mt-2 text-neutral-500">
                If an assignor introduced you to GotREFS, add their name and email or phone so we can credit them.
                You can skip this if no one recommended you.
              </p>
              <div className="mt-8 space-y-4">
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Assignor name</span>
                  <input
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={recommendedAssignorName}
                    onChange={(event) => onRecommendedAssignorName(event.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Email (or phone below)</span>
                  <input
                    type="email"
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={recommendedAssignorEmail}
                    onChange={(event) => onRecommendedAssignorEmail(event.target.value)}
                    placeholder="assignor@example.com"
                    autoComplete="email"
                  />
                </label>
                <label className="block rounded-2xl border border-neutral-300 px-5 py-4">
                  <span className="text-xs text-neutral-500">Phone</span>
                  <input
                    type="tel"
                    className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
                    value={recommendedAssignorPhone}
                    onChange={(event) => onRecommendedAssignorPhone(event.target.value)}
                    placeholder="(555) 555-5555"
                    autoComplete="tel"
                  />
                </label>
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
          {screen === "assignorRecommend" ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={(event) => submitAssignor(event as unknown as FormEvent, { skip: true })}
                className="rounded-lg px-4 py-3.5 text-sm font-semibold text-neutral-900 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Skip for now
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={(event) => submitAssignor(event as unknown as FormEvent)}
                className="rounded-lg bg-neutral-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {nextLabel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={handleNext}
              className="rounded-lg bg-neutral-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
