"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { ADDITIONAL_SPORTS, PRIMARY_SPORTS } from "@/data/sports";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { validatePasswordStrength } from "@/lib/auth/password";

const REF_AVATARS = [
  { id: "mj", label: "MJ", name: "Marcus style", bg: "from-amber-700 to-slate-950" },
  { id: "ar", label: "AR", name: "Blue crew", bg: "from-blue-600 to-slate-950" },
  { id: "kt", label: "KT", name: "Red badge", bg: "from-red-600 to-slate-950" },
  { id: "js", label: "JS", name: "Gold whistle", bg: "from-yellow-600 to-slate-950" },
  { id: "np", label: "NP", name: "Night game", bg: "from-purple-600 to-slate-950" },
] as const;

const AVAILABILITY_OPTIONS = [
  "Weeknights",
  "Weekends",
  "After school",
  "Tournament travel",
  "Mornings",
  "Open availability",
] as const;

const REGION_OPTIONS = ["Local city", "County-wide", "Statewide", "Neighboring states", "Tournament travel"] as const;

function buildGotrefsId(seed: string) {
  const source = seed.trim() || "new-ref";
  const hash = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `GR-2026-${String((hash % 9000) + 1000)}`;
}

export function SignupForm() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const requestedRole = searchParams.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"ref" | "organizer">(
    requestedRole === "organizer" || requestedRole === "ref" ? requestedRole : "ref"
  );
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [step, setStep] = useState(0);
  const [primarySport, setPrimarySport] = useState("");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [certificationLevel, setCertificationLevel] = useState("");
  const [certifiedBy, setCertifiedBy] = useState("");
  const [baseCity, setBaseCity] = useState("");
  const [workRegions, setWorkRegions] = useState<string[]>([]);
  const [travelRadius, setTravelRadius] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<(typeof REF_AVATARS)[number]["id"]>("mj");
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string[]>([]);
  const [verificationChoice, setVerificationChoice] = useState<"now" | "later" | null>(null);
  const [idProofSelected, setIdProofSelected] = useState(false);
  const [certProofSelected, setCertProofSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRef = roleConfirmed && role === "ref";
  const fullName = `${firstName} ${lastName}`.trim();
  const gotrefsId = useMemo(() => buildGotrefsId(email || fullName), [email, fullName]);
  const stepLabels = ["Profile", "Logistics", "Verify"];
  const selectedAvatarConfig = REF_AVATARS.find((avatar) => avatar.id === selectedAvatar) ?? REF_AVATARS[0];
  const avatarLabel = fullName
    ? fullName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : selectedAvatarConfig.label;
  const availabilitySummary = availability.length ? availability.join(", ") : "";
  const canContinue = useMemo(() => {
    if (!isRef) return true;
    if (step === 0) {
      return firstName.trim().length >= 2 && lastName.trim().length >= 2 && Boolean(primarySport.trim());
    }
    if (step === 1) return Boolean(baseCity.trim() && workRegions.length && travelRadius.trim());
    return true;
  }, [
    baseCity,
    firstName,
    isRef,
    lastName,
    primarySport,
    step,
    travelRadius,
    workRegions.length,
  ]);

  function nextStep() {
    setError(null);
    if (!canContinue) {
      setError("Fill out this card section before moving on.");
      return;
    }
    setStep((current) => Math.min(current + 1, stepLabels.length - 1));
  }

  function toggleAdditionalSport(sport: string) {
    setAdditionalSports((current) =>
      current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport]
    );
  }

  function toggleAvailability(value: string) {
    setAvailability((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function toggleWorkRegion(value: string) {
    setWorkRegions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function previewUploadedPhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function jumpToStep(nextStep: number) {
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_SETUP_HINT);
      return;
    }

    if (role === "ref" && !verificationChoice) {
      setError("Choose Upload documents now or Skip for now.");
      return;
    }

    if (role === "ref" && verificationChoice === "now" && (!idProofSelected || !certProofSelected)) {
      setError("Select both your ID and certification files, or choose Skip for now.");
      return;
    }

    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          organizationName: role === "organizer" ? organizationName.trim() : undefined,
          phone: role === "organizer" ? phone.trim() : undefined,
          primarySport: role === "ref" ? primarySport.trim() : undefined,
          additionalSports: role === "ref" ? additionalSports : undefined,
          certificationLevel: role === "ref" ? certificationLevel.trim() : undefined,
          certifiedBy: role === "ref" ? certifiedBy.trim() : undefined,
          gotrefsId: role === "ref" ? gotrefsId : undefined,
          baseCity: role === "ref" ? baseCity.trim() : undefined,
          workRegions: role === "ref" ? workRegions : undefined,
          travelRadius: role === "ref" ? Number(travelRadius) || null : undefined,
          verificationSkipped: role === "ref" ? verificationChoice === "later" : undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        needsEmailConfirmation?: boolean;
        redirect?: string;
        role?: "ref" | "organizer";
      };
      if (!res.ok) {
        setError(json.error || "Could not create account.");
        return;
      }
      const dest = json.redirect || "/dashboard";
      window.location.assign(dest);
    } catch {
      setError(
        "Could not reach Supabase (Failed to fetch). On Vercel: confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set for Production, then Redeploy."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-6xl px-3 py-6 sm:px-4 sm:py-10 md:py-16">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--red)] sm:text-sm sm:tracking-[0.18em]">
            Create your profile
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-[var(--blue-text)] sm:text-4xl">
            Build your ref ID as you sign up.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Start browsing games right away in pending verification. Finish your ID, certification, and background
            badges when you are ready to accept assignments.
          </p>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-[var(--red)] underline">
            Log in
          </Link>
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl gap-5 sm:gap-6">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white/90 p-4 shadow-xl shadow-slate-200/70 sm:rounded-[2rem] sm:p-6">
          {!isSupabaseConfigured() && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {SUPABASE_SETUP_HINT}
            </p>
          )}

          {!roleConfirmed && (
            <div>
              <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 1: I am a...</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Choose your role. Selecting referee starts your live digital ID card.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole("ref");
                    setRoleConfirmed(true);
                    setStep(0);
                    setError(null);
                  }}
                  className="rounded-2xl border border-[var(--red)] bg-[var(--red)] px-5 py-4 text-left font-bold text-white shadow-sm"
                >
                  I am a Referee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole("organizer");
                    setRoleConfirmed(true);
                    setStep(0);
                    setError(null);
                  }}
                  className="rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-left font-bold text-[var(--navy)] shadow-sm"
                >
                  I am an Event Organizer
                </button>
              </div>
            </div>
          )}

          {isRef && (
            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 sm:mt-6 sm:gap-2">
              {stepLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition sm:text-xs sm:tracking-[0.14em] ${
                    index === step
                      ? "bg-[var(--red)] text-white"
                      : index < step
                        ? "bg-[var(--blue)]/10 text-[var(--blue)]"
                        : "bg-[var(--grey-light)] text-[var(--muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {roleConfirmed && <form ref={formRef} onSubmit={onSubmit} className="mt-6 flex flex-col gap-5 sm:mt-8">
            {isRef && step === 0 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 1: I am a referee</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Fill in the fields below and watch your GotREFS Referee card update above.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">First name</span>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="rounded-xl border border-[var(--border)] px-3 py-3"
                      autoComplete="given-name"
                      placeholder="Marcus"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">Last name</span>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="rounded-xl border border-[var(--border)] px-3 py-3"
                      autoComplete="family-name"
                      placeholder="Johnson"
                    />
                  </label>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {REF_AVATARS.map((avatar) => {
                    const active = selectedAvatar === avatar.id && !avatarPhotoUrl;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setSelectedAvatar(avatar.id);
                          setAvatarPhotoUrl(null);
                        }}
                        className={`rounded-2xl border p-2 text-center transition ${
                          active ? "border-[var(--red)] bg-[var(--red)]/10" : "border-[var(--border)] bg-white"
                        }`}
                      >
                        <span
                          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${avatar.bg} text-sm font-black text-white`}
                        >
                          {avatarLabel}
                        </span>
                        <span className="mt-2 block text-[11px] font-semibold text-[var(--navy)]">
                          {avatar.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--blue)]/35 bg-[var(--blue)]/5 px-4 py-5 text-center">
                  <span className="text-sm font-bold text-[var(--blue)]">Upload your own photo</span>
                  <span className="mt-1 text-xs text-[var(--muted)]">Preview only for now — JPG or PNG</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="sr-only"
                    onChange={(e) => previewUploadedPhoto(e.target.files?.[0])}
                  />
                </label>
                <label className="mt-5 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Primary sport</span>
                  <select
                    value={primarySport}
                    onChange={(e) => setPrimarySport(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                  >
                    {[...PRIMARY_SPORTS, ...ADDITIONAL_SPORTS].map((sportName) => (
                      <option key={sportName} value={sportName}>
                        {sportName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4">
                  <p className="text-sm font-medium text-[var(--blue-text)]">Additional sports</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ADDITIONAL_SPORTS.slice(0, 12).map((sportName) => {
                      const active = additionalSports.includes(sportName);
                      return (
                        <button
                          key={sportName}
                          type="button"
                          onClick={() => toggleAdditionalSport(sportName)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-[var(--blue)] bg-[var(--blue)] text-white"
                              : "border-[var(--border)] bg-white text-[var(--muted)]"
                          }`}
                        >
                          {sportName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {isRef && step === 1 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 2: Logistics & availability</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Regions, travel radius, and availability populate the card instantly.
                </p>
                <label className="mt-5 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Base city</span>
                  <input
                    value={baseCity}
                    onChange={(e) => setBaseCity(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                    placeholder="Phoenix, AZ"
                  />
                </label>
                <label className="mt-4 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Travel radius (miles)</span>
                  <input
                    type="number"
                    min={0}
                    value={travelRadius}
                    onChange={(e) => setTravelRadius(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                  />
                </label>
                <div className="mt-4">
                  <p className="text-sm font-medium text-[var(--blue-text)]">States / regions willing to work</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {REGION_OPTIONS.map((option) => {
                      const active = workRegions.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleWorkRegion(option)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-[var(--blue)] bg-[var(--blue)] text-white"
                              : "border-[var(--border)] bg-white text-[var(--muted)]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-sm font-medium text-[var(--blue-text)]">Availability</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AVAILABILITY_OPTIONS.map((option) => {
                      const active = availability.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleAvailability(option)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-[var(--blue)] bg-[var(--blue)] text-white"
                              : "border-[var(--border)] bg-white text-[var(--muted)]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {isRef && step === 2 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 3: Verification core</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Upload now to mark checks as processing, or skip for now to show red unverified badges.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setVerificationChoice("now")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      verificationChoice === "now"
                        ? "border-[var(--blue)] bg-[var(--blue)]/10"
                        : "border-[var(--border)] bg-white"
                    }`}
                  >
                    <p className="font-bold text-[var(--navy)]">Upload documents now</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      ID and certification badges show processing until approval.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationChoice("later")}
                    className={`rounded-2xl border p-4 text-left transition ${
                      verificationChoice === "later"
                        ? "border-red-300 bg-red-50"
                        : "border-[var(--border)] bg-white"
                    }`}
                  >
                    <p className="font-bold text-red-800">Skip for now</p>
                    <p className="mt-1 text-sm text-red-700">
                      The card becomes draft mode with red unverified badges.
                    </p>
                  </button>
                </div>
                {verificationChoice === "now" && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer flex-col rounded-2xl border-2 border-dashed border-[var(--blue)]/35 bg-[var(--blue)]/5 p-4 text-sm">
                      <span className="font-bold text-[var(--blue)]">Upload state ID</span>
                      <span className="mt-1 text-xs text-[var(--muted)]">Preview only during signup</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="sr-only"
                        onChange={(e) => setIdProofSelected(Boolean(e.target.files?.[0]))}
                      />
                      {idProofSelected && <span className="mt-2 font-semibold text-amber-700">Identity processing</span>}
                    </label>
                    <label className="flex cursor-pointer flex-col rounded-2xl border-2 border-dashed border-[var(--blue)]/35 bg-[var(--blue)]/5 p-4 text-sm">
                      <span className="font-bold text-[var(--blue)]">Upload NFHS / certification</span>
                      <span className="mt-1 text-xs text-[var(--muted)]">Preview only during signup</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="sr-only"
                        onChange={(e) => setCertProofSelected(Boolean(e.target.files?.[0]))}
                      />
                      {certProofSelected && <span className="mt-2 font-semibold text-amber-700">Certification processing</span>}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-[var(--blue-text)]">Certified by</span>
                      <input
                        value={certifiedBy}
                        onChange={(e) => setCertifiedBy(e.target.value)}
                        className="rounded-xl border border-[var(--border)] px-3 py-3"
                        placeholder="NFHS, state association, local association"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-[var(--blue-text)]">Certification level</span>
                      <input
                        value={certificationLevel}
                        onChange={(e) => setCertificationLevel(e.target.value)}
                        className="rounded-xl border border-[var(--border)] px-3 py-3"
                        placeholder="Youth, varsity, NFHS, USSF, etc."
                      />
                    </label>
                  </div>
                )}
                {verificationChoice === "later" && (
                  <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                    Your card is live in draft mode, but organizations cannot hire you until these red badges turn green.
                  </p>
                )}
                <div className="mt-5 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--blue)]">Generated ID</p>
                  <p className="mt-1 break-all text-xl font-black text-[var(--navy)] sm:text-2xl">{gotrefsId}</p>
                </div>
                <div className="mt-5 grid gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">Email</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl border border-[var(--border)] px-3 py-3"
                      autoComplete="email"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">Password</span>
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters, with a letter and number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl border border-[var(--border)] px-3 py-3"
                    />
                  </label>
                </div>
              </div>
            )}

            {isRef && step === 3 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 4: Sports selection</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Selecting sports unlocks and highlights the eligible sport icons on the card.
                </p>
                <label className="mt-5 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Primary sport</span>
                  <select
                    value={primarySport}
                    onChange={(e) => setPrimarySport(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                  >
                    {[...PRIMARY_SPORTS, ...ADDITIONAL_SPORTS].map((sportName) => (
                      <option key={sportName} value={sportName}>
                        {sportName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4">
                  <p className="text-sm font-medium text-[var(--blue-text)]">Additional sports</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ADDITIONAL_SPORTS.slice(0, 12).map((sportName) => {
                      const active = additionalSports.includes(sportName);
                      return (
                        <button
                          key={sportName}
                          type="button"
                          onClick={() => toggleAdditionalSport(sportName)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            active
                              ? "border-[var(--blue)] bg-[var(--blue)] text-white"
                              : "border-[var(--border)] bg-white text-[var(--muted)]"
                          }`}
                        >
                          {sportName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {isRef && step === 4 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 5: Certifications</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Certification details populate the Certified By section. The upload badge stays pending until the
                  credential is uploaded and reviewed.
                </p>
                <label className="mt-5 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Certified by</span>
                  <input
                    value={certifiedBy}
                    onChange={(e) => setCertifiedBy(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                    placeholder="NFHS, AIA, USSF, local association"
                  />
                </label>
                <label className="mt-4 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Certification level</span>
                  <input
                    value={certificationLevel}
                    onChange={(e) => setCertificationLevel(e.target.value)}
                    className="rounded-xl border border-[var(--border)] px-3 py-3"
                    placeholder="Youth, varsity, NFHS, USSF, etc."
                  />
                </label>
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--grey-light)]/40 p-4 text-sm text-[var(--muted)]">
                  Certification document upload happens inside the dashboard after account creation, so files are
                  securely tied to the signed-in ref.
                </div>
              </div>
            )}

            {isRef && step === 5 && (
              <div>
                <h2 className="text-xl font-black text-[var(--navy)] sm:text-2xl">Step 6: Verification checks</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Your card starts in pending verification. Identity, background, and certified official badges turn
                  bright when those checks are completed and approved.
                </p>
                <div className="mt-5 grid gap-3">
                  {["Identity Verification", "Background Screening", "Certified Official Review"].map((label) => (
                    <div key={label} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-bold text-amber-900">{label}</p>
                      <p className="mt-1 text-xs text-amber-800">Pending — finish in the dashboard after signup.</p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/5 p-4 text-sm text-[var(--slate)]">
                  After signup, refs can browse games immediately in pending status. They will finish uploads and
                  background screening before accepting paid assignments.
                </p>
              </div>
            )}

            {roleConfirmed && role === "organizer" && (
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">First name</span>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      autoComplete="given-name"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-[var(--blue-text)]">Last name</span>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2"
                      autoComplete="family-name"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Organization name (optional)</span>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Westside Youth Basketball"
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Phone number</span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    autoComplete="tel"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    autoComplete="email"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-[var(--blue-text)]">Password</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters, with a letter and number"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                  />
                </label>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {info && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{info}</p>}

            {isRef && step < stepLabels.length - 1 ? (
              <button type="button" onClick={nextStep} className="btn-primary w-full py-3">
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 disabled:opacity-50"
              >
                {loading ? "Creating..." : isRef ? "Create pending ref profile" : "Sign up"}
              </button>
            )}
          </form>}

          {isRef && (
            <div className="mt-6">
              <RefereeIdCard
                fullName={fullName}
                gotrefsId={email ? gotrefsId : undefined}
                cardTitle="GotREFS Referee"
                primarySport={primarySport}
                additionalSports={additionalSports}
                certificationLevel={certificationLevel}
                certifiedBy={certifiedBy}
                avatarUrl={avatarPhotoUrl ?? undefined}
                avatarLabel={avatarLabel}
                baseCity={baseCity}
                workRegions={workRegions}
                travelRadius={travelRadius}
                availabilitySummary={availabilitySummary}
                verificationSkipped={verificationChoice === "later"}
                emptyPlaceholders
                onEditField={(field) => {
                  if (field === "verification") jumpToStep(2);
                  if (field === "profile" || field === "photo" || field === "sports") jumpToStep(0);
                  if (field === "location" || field === "availability") jumpToStep(1);
                }}
              />
              {verificationChoice === "later" ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
                  <strong>Your card is live in draft mode.</strong> Organizations cannot hire you until the red
                  badges turn green.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/80 p-4 text-sm text-[var(--muted)] shadow-sm">
                  <strong className="text-[var(--navy)]">Answer one prompt at a time.</strong> The card stays blank
                  until each field is filled in.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
