"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { validatePasswordStrength } from "@/lib/auth/password";
import { BRAND_NAME } from "@/lib/brand";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { ALL_SPORTS, OTHER_SPORT_VALUE, sportPickerToStored } from "@/data/sports";
import { OAuthContinueButton } from "@/components/auth/OAuthContinueButton";
import { uploadRefSignupDocuments, submitRefVerificationForReview } from "@/lib/auth/upload-ref-signup-docs";

type AuthStep = "email" | "password" | "role" | "onboarding";
type AudienceRole = "ref" | "organizer" | "assignor";

const ROLE_CARDS: Array<{
  role: AudienceRole;
  title: string;
  description: string;
}> = [
  {
    role: "ref",
    title: "I am a Referee",
    description: "Find games, accept assignments, and manage your schedule.",
  },
  {
    role: "organizer",
    title: "I am an Event Organizer",
    description: "Create tournaments, manage leagues, and hire staff.",
  },
  {
    role: "assignor",
    title: "I am an Assignor",
    description: "Schedule official crews and manage referee pools.",
  },
];

const WORK_REGION_OPTIONS = ["Local city", "County-wide", "Statewide", "Neighboring states", "Tournament travel"];

function buildGotrefsId(seed: string) {
  const source = seed.trim() || "new-ref";
  const hash = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `GR-2026-${String((hash % 9000) + 1000)}`;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function AuthFlow() {
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role");
  const initialRole: AudienceRole =
    requestedRole === "organizer" || requestedRole === "assignor" || requestedRole === "ref"
      ? requestedRole
      : "ref";
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AudienceRole>(initialRole);
  const [wizardStep, setWizardStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [photoSelected, setPhotoSelected] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [phone, setPhone] = useState("");
  const [primarySport, setPrimarySport] = useState("Basketball");
  const [customPrimarySport, setCustomPrimarySport] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>(["Basketball"]);
  const [certificationLevel, setCertificationLevel] = useState("");
  const [govIdFrontFile, setGovIdFrontFile] = useState<File | null>(null);
  const [govIdBackFile, setGovIdBackFile] = useState<File | null>(null);
  const [certDocFile, setCertDocFile] = useState<File | null>(null);
  const [baseCity, setBaseCity] = useState("");
  const [travelRadius, setTravelRadius] = useState("25");
  const [workRegions, setWorkRegions] = useState<string[]>(["Local city"]);
  const [governingBodies, setGoverningBodies] = useState("");
  const [crewInvite, setCrewInvite] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const authError = searchParams.get("error");
    const reason = searchParams.get("reason");
    if (!authError) return null;
    if (reason) return `Sign-in failed: ${decodeURIComponent(reason)}.`;
    return "Sign-in failed. Please try again.";
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [existingProviders, setExistingProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const oauthMode = searchParams.get("oauth") === "1";

  useEffect(() => {
    if (!oauthMode) return;

    async function bootOAuthSignup() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Google sign-in session expired. Please try Continue with Google again.");
        setStep("email");
        return;
      }

      setEmail(user.email ?? "");
      const nameFromMeta =
        String(user.user_metadata?.full_name ?? "").trim() ||
        `${String(user.user_metadata?.first_name ?? "").trim()} ${String(user.user_metadata?.last_name ?? "").trim()}`.trim();
      if (nameFromMeta) setFullName(nameFromMeta);

      try {
        const adminCheck = await fetch("/api/auth/admin-check");
        const adminJson = (await adminCheck.json()) as { isAdmin?: boolean };
        if (adminJson.isAdmin) {
          window.location.assign("/dashboard/admin");
          return;
        }
      } catch {
        // Continue with normal OAuth onboarding if admin check fails.
      }

      const stepParam = searchParams.get("step");
      setStep(stepParam === "onboarding" ? "onboarding" : "role");
    }

    void bootOAuthSignup();
  }, [oauthMode, searchParams]);

  const gotrefsId = useMemo(() => buildGotrefsId(email || fullName), [email, fullName]);
  const roleCard = ROLE_CARDS.find((item) => item.role === role) ?? ROLE_CARDS[0];
  const progress =
    role === "ref"
      ? ["Profile", "Sports", "Government ID", "Certification", "Location"]
      : role === "organizer"
        ? ["Organization", "Payments", "Account"]
        : ["Authority", "Crew", "Account"];
  const resolvedPrimarySport = sportPickerToStored(primarySport, customPrimarySport);

  function toggleSport(sport: string) {
    setSelectedSports((current) => {
      const next = current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport];
      if (next.length > 0 && !next.includes(primarySport)) setPrimarySport(next[0]);
      return next;
    });
  }

  function toggleRegion(region: string) {
    setWorkRegions((current) =>
      current.includes(region) ? current.filter((item) => item !== region) : [...current, region]
    );
  }

  async function continueWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured()) {
      setError(SUPABASE_SETUP_HINT);
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const json = (await res.json()) as { exists?: boolean; providers?: string[]; error?: string };
      if (!res.ok) {
        setError(json.error || "Could not check this email.");
        return;
      }
      setEmail(normalized);
      setExistingProviders(json.providers ?? []);
      setStep(json.exists ? "password" : "role");
    } catch {
      setError("Could not reach the server. Check your local environment and try again.");
    } finally {
      setLoading(false);
    }
  }

  function startSignup() {
    setError(null);
    setNotice(null);
    const normalized = email.trim().toLowerCase();
    if (normalized) setEmail(normalized);
    setExistingProviders([]);
    setWizardStep(0);
    setStep(requestedRole === "organizer" || requestedRole === "assignor" || requestedRole === "ref" ? "onboarding" : "role");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { error?: string; role?: "ref" | "organizer"; redirect?: string };
      if (!res.ok) {
        setError(
          existingProviders.includes("google")
            ? "That password did not work. This email is connected to Google, so use Continue with Google below."
            : json.error || "Invalid email or password."
        );
        return;
      }
      const next = searchParams.get("next");
      const destination =
        next && next !== "/dashboard"
          ? next
          : json.redirect || (json.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee");
      window.location.assign(destination);
    } catch {
      setError("Could not reach the server. Check web/.env.local and try again.");
    } finally {
      setLoading(false);
    }
  }

  function nextWizardStep() {
    setError(null);
    if (role === "ref" && wizardStep === 0 && fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError("Enter your first and last name.");
      return;
    }
    if (role === "organizer" && wizardStep === 0 && !organizationName.trim()) {
      setError("Enter your organization or club name.");
      return;
    }
    if (role === "organizer" && wizardStep === 0 && primarySport === OTHER_SPORT_VALUE && !customPrimarySport.trim()) {
      setError("Enter your sport or league type.");
      return;
    }
    if (role === "assignor" && wizardStep === 0 && !governingBodies.trim()) {
      setError("Enter at least one league, association, or governing body.");
      return;
    }
    if (role === "ref" && wizardStep === 1 && primarySport === OTHER_SPORT_VALUE && !customPrimarySport.trim()) {
      setError("Enter the sport you officiate.");
      return;
    }
    if (role === "ref" && wizardStep === 2 && (!govIdFrontFile || !govIdBackFile)) {
      setError("Upload the front and back of your government ID to continue.");
      return;
    }
    if (role === "ref" && wizardStep === 3 && !certDocFile) {
      setError("Upload your certification or license document to continue.");
      return;
    }
    setWizardStep((current) => Math.min(current + 1, progress.length - 1));
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const { firstName, lastName } = splitName(fullName);
    if (!firstName || !lastName) {
      setError("Enter your first and last name.");
      return;
    }
    if (!termsAccepted) {
      setError("Please confirm that you accept the GotREFS terms and policies to create your account.");
      return;
    }

    if (!oauthMode) {
      const pwErr = validatePasswordStrength(password);
      if (pwErr) {
        setError(pwErr);
        return;
      }
    }

    setLoading(true);
    try {
      const isOrganizer = role === "organizer";
      const payload = {
        email,
        firstName,
        lastName,
        role: isOrganizer ? "organizer" : "ref",
        isAssignor: role === "assignor",
        organizationName: isOrganizer ? organizationName.trim() : undefined,
        phone: isOrganizer ? phone.trim() : undefined,
        primarySport: resolvedPrimarySport,
        additionalSports: selectedSports.filter((sport) => sport !== primarySport),
        certificationLevel: certificationLevel.trim() || undefined,
        gotrefsId,
        baseCity: baseCity.trim() || undefined,
        workRegions,
        travelRadius: Number(travelRadius) || null,
        governingBodies: governingBodies.trim() || undefined,
        crewInvite: crewInvite.trim() || undefined,
        verificationSkipped: role === "ref" ? !(govIdFrontFile && govIdBackFile && certDocFile) : undefined,
        termsAccepted,
        acceptedTermsSlug: role === "organizer" ? "event-organizer-terms" : "referee-official-terms",
        ...(oauthMode ? {} : { password }),
      };

      const res = await fetch(oauthMode ? "/api/auth/complete-oauth-signup" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; redirect?: string; userId?: string | null };
      if (!res.ok) {
        setError(json.error || "Could not create your account.");
        return;
      }

      const userId = json.userId;
      if (role === "ref" && govIdFrontFile && govIdBackFile && certDocFile) {
        try {
          let memberId = userId;
          if (!memberId) {
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            memberId = user?.id ?? null;
          }
          if (memberId) {
            await uploadRefSignupDocuments(
              memberId,
              {
                govIdFront: govIdFrontFile,
                govIdBack: govIdBackFile,
                certificationDocument: certDocFile,
              },
              {
                primarySport: resolvedPrimarySport,
                additionalSports: selectedSports.filter((sport) => sport !== resolvedPrimarySport),
                certificationLevel: certificationLevel.trim() || "Youth / Recreational",
              }
            );
            await submitRefVerificationForReview();
          }
        } catch {
          setNotice("Account created, but verification could not be submitted automatically. You can finish from your dashboard.");
        }
      }

      const next = searchParams.get("next");
      const destination = next && next !== "/dashboard" ? next : json.redirect || "/dashboard";
      window.location.assign(destination);
    } catch {
      setError("Could not reach the server. Check web/.env.local and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Secure marketplace access</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--navy)]">Welcome to {BRAND_NAME}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            One clean entry point for referees, organizers, and assignors.
          </p>
        </div>

        {step === "email" && (
          <form onSubmit={continueWithEmail} className="space-y-4">
            <label className="block text-sm font-bold text-[var(--navy)]">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--navy)] to-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
            <button
              type="button"
              onClick={startSignup}
              className="mx-auto block text-xs font-bold text-[var(--muted)] underline-offset-4 hover:text-[var(--navy)] hover:underline"
            >
              Sign up
            </button>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid gap-2">
              <OAuthContinueButton
                provider="google"
                className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-[var(--navy)] transition hover:border-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
              >
                [G] Continue with Google
              </OAuthContinueButton>
              <OAuthContinueButton
                provider="apple"
                className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-[var(--navy)] transition hover:border-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
              >
                [A] Continue with Apple
              </OAuthContinueButton>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={login} className="space-y-4">
            <button type="button" onClick={() => setStep("email")} className="text-sm font-bold text-[var(--muted)]">
              Back to email
            </button>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Existing account</p>
              <p className="mt-1 font-bold text-[var(--navy)]">{email}</p>
              {existingProviders.includes("google") && (
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  This email is connected to Google. You can continue with Google or use a password if you added one.
                </p>
              )}
            </div>
            <label className="block text-sm font-bold text-[var(--navy)]">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10"
              />
            </label>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {loading ? "Signing in..." : "Log in"}
            </button>
            {existingProviders.includes("google") && (
              <>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  or
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <OAuthContinueButton
                  provider="google"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-[var(--navy)] transition hover:border-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
                >
                  [G] Continue with Google
                </OAuthContinueButton>
              </>
            )}
          </form>
        )}

        {step === "role" && (
          <div className="space-y-4">
            {!oauthMode && (
              <button type="button" onClick={() => setStep("email")} className="text-sm font-bold text-[var(--muted)]">
                Back to email
              </button>
            )}
            {oauthMode && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
                Signed in with Google as {email}. Choose how you will use {BRAND_NAME}.
              </p>
            )}
            <div>
              <h2 className="text-xl font-black text-[var(--navy)]">What is your primary role today?</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">We will tailor setup around how you use {BRAND_NAME}.</p>
            </div>
            <div className="grid gap-3">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  onClick={() => {
                    setRole(card.role);
                    setTermsAccepted(false);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    role === card.role ? "border-[var(--navy)] bg-slate-50 shadow-sm" : "border-slate-200 hover:border-[var(--navy)]"
                  }`}
                >
                  <span className="block font-black text-[var(--navy)]">{card.title}</span>
                  <span className="mt-1 block text-sm text-[var(--muted)]">{card.description}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setWizardStep(0);
                setStep("onboarding");
              }}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--navy)] to-emerald-600 px-5 py-3 text-sm font-black text-white"
            >
              Continue as {roleCard.title.replace("I am a ", "")}
            </button>
          </div>
        )}

        {step === "onboarding" && (
          <form onSubmit={register} className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep("role")} className="text-sm font-bold text-[var(--muted)]">
                Back to role
              </button>
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Step {wizardStep + 1} of {progress.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--navy)] to-emerald-600 transition-all"
                style={{ width: `${((wizardStep + 1) / progress.length) * 100}%` }}
              />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[var(--red)]">{roleCard.title}</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--navy)]">{progress[wizardStep]}</h2>
            </div>

            {role === "ref" && wizardStep === 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Legal name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="First and last name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 p-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                    {photoSelected ? "Ready" : "Photo"}
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[var(--navy)]">Upload profile photo</span>
                    <span className="block text-xs text-[var(--muted)]">Circle preview template. You can update this later.</span>
                  </span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => setPhotoSelected(Boolean(event.target.files?.[0]))} />
                </label>
              </div>
            )}

            {role === "ref" && wizardStep === 1 && (
              <SportsAndCerts
                selectedSports={selectedSports}
                primarySport={primarySport}
                customPrimarySport={customPrimarySport}
                certificationLevel={certificationLevel}
                onToggleSport={toggleSport}
                onPrimarySport={setPrimarySport}
                onCustomPrimarySport={setCustomPrimarySport}
                onCertificationLevel={setCertificationLevel}
              />
            )}

            {role === "ref" && wizardStep === 2 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Upload a clear photo or scan of your government-issued ID. We need both the front and back.
                </p>
                <SignupFileUpload
                  label="Government ID — front"
                  file={govIdFrontFile}
                  onFile={setGovIdFrontFile}
                />
                <SignupFileUpload
                  label="Government ID — back"
                  file={govIdBackFile}
                  onFile={setGovIdBackFile}
                />
              </div>
            )}

            {role === "ref" && wizardStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  Upload your referee certification, license, or training credential (NFHS card, state license, USSF, etc.).
                </p>
                <SignupFileUpload
                  label="Certification / license document"
                  file={certDocFile}
                  onFile={setCertDocFile}
                />
              </div>
            )}

            {role === "ref" && wizardStep === 4 && (
              <LocationAndAccount
                email={email}
                baseCity={baseCity}
                travelRadius={travelRadius}
                workRegions={workRegions}
                password={password}
                onEmail={setEmail}
                onBaseCity={setBaseCity}
                onTravelRadius={setTravelRadius}
                onToggleRegion={toggleRegion}
                onPassword={setPassword}
                oauthMode={oauthMode}
              />
            )}

            {role === "organizer" && wizardStep === 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Your name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="First and last name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Company or club name
                  <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Westside Youth Basketball" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Primary sport or league type
                  <select value={primarySport} onChange={(event) => setPrimarySport(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
                    {ALL_SPORTS.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
                    <option value={OTHER_SPORT_VALUE}>Other</option>
                  </select>
                </label>
                {primarySport === OTHER_SPORT_VALUE && (
                  <label className="block text-sm font-bold text-[var(--navy)]">
                    Type your sport or league
                    <input
                      value={customPrimarySport}
                      onChange={(event) => setCustomPrimarySport(event.target.value)}
                      placeholder="e.g. Dodgeball, Boxing, Local league"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                    />
                  </label>
                )}
              </div>
            )}

            {role === "organizer" && wizardStep === 1 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-black text-emerald-900">Payout setup</p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Stripe Connect onboarding will live here. For now, your account can be created and you can add events while payments are configured.
                </p>
              </div>
            )}

            {role === "organizer" && wizardStep === 2 && (
              <AccountFields
                fullName={fullName}
                email={email}
                phone={phone}
                password={password}
                onFullName={setFullName}
                onEmail={setEmail}
                onPhone={setPhone}
                onPassword={setPassword}
                oauthMode={oauthMode}
              />
            )}

            {role === "assignor" && wizardStep === 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Your name
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="First and last name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
                <label className="block text-sm font-bold text-[var(--navy)]">
                  Governing bodies
                  <textarea value={governingBodies} onChange={(event) => setGoverningBodies(event.target.value)} placeholder="Leagues, high school associations, clubs, or tournaments you assign for" className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3" />
                </label>
              </div>
            )}

            {role === "assignor" && wizardStep === 1 && (
              <label className="block text-sm font-bold text-[var(--navy)]">
                Invite your crew
                <textarea value={crewInvite} onChange={(event) => setCrewInvite(event.target.value)} placeholder="Paste emails or names, one per line. CSV upload can be added next." className="mt-2 min-h-36 w-full rounded-xl border border-slate-200 px-4 py-3" />
              </label>
            )}

            {role === "assignor" && wizardStep === 2 && (
              <AccountFields
                fullName={fullName}
                email={email}
                phone={phone}
                password={password}
                onFullName={setFullName}
                onEmail={setEmail}
                onPhone={setPhone}
                onPassword={setPassword}
                oauthMode={oauthMode}
              />
            )}

            {wizardStep < progress.length - 1 ? (
              <button type="button" onClick={nextWizardStep} className="w-full rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-black text-white">
                Continue
              </button>
            ) : (
              <>
                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1"
                    required
                  />
                  <span>
                    I have read and agree to the{" "}
                    <a
                      href={role === "organizer" ? "/policies/event-organizer-terms" : "/policies/referee-official-terms"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[var(--navy)] underline"
                    >
                      {role === "organizer" ? "Event Organizer Terms & Conditions" : "Referee & Official Terms & Conditions"}
                    </a>
                    ,{" "}
                    <a href="/policies/privacy-policy" target="_blank" rel="noreferrer" className="font-bold text-[var(--navy)] underline">
                      Privacy Policy
                    </a>
                    ,{" "}
                    <a href="/policies/payment-fee-policy" target="_blank" rel="noreferrer" className="font-bold text-[var(--navy)] underline">
                      Payment & Fee Policy
                    </a>
                    , and{" "}
                    <a href="/policies/community-standards" target="_blank" rel="noreferrer" className="font-bold text-[var(--navy)] underline">
                      Community Standards
                    </a>
                    .
                  </span>
                </label>
                <button type="submit" disabled={loading || !termsAccepted} className="w-full rounded-xl bg-gradient-to-r from-[var(--navy)] to-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {loading ? "Saving..." : oauthMode ? "Finish setup" : "Create account"}
                </button>
              </>
            )}
          </form>
        )}

        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        {notice && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{notice}</p>}
      </section>
    </main>
  );
}

function SignupFileUpload({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col rounded-2xl border-2 border-dashed border-[var(--blue)]/35 bg-[var(--blue)]/5 p-4 text-sm transition hover:border-[var(--blue)]">
      <span className="font-bold text-[var(--navy)]">{label}</span>
      <span className="mt-1 text-xs text-[var(--muted)]">JPG, PNG, or PDF</span>
      {file ? (
        <span className="mt-2 font-semibold text-green-700">{file.name}</span>
      ) : (
        <span className="mt-2 font-semibold text-[var(--blue)]">Choose file to upload</span>
      )}
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,.webp"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SportsAndCerts({
  selectedSports,
  primarySport,
  customPrimarySport,
  certificationLevel,
  onToggleSport,
  onPrimarySport,
  onCustomPrimarySport,
  onCertificationLevel,
}: {
  selectedSports: string[];
  primarySport: string;
  customPrimarySport: string;
  certificationLevel: string;
  onToggleSport: (sport: string) => void;
  onPrimarySport: (sport: string) => void;
  onCustomPrimarySport: (value: string) => void;
  onCertificationLevel: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-[var(--navy)]">
        Primary sport
        <select value={primarySport} onChange={(event) => onPrimarySport(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
          {ALL_SPORTS.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
          <option value={OTHER_SPORT_VALUE}>Other</option>
        </select>
      </label>
      {primarySport === OTHER_SPORT_VALUE && (
        <label className="block text-sm font-bold text-[var(--navy)]">
          Type your sport
          <input
            value={customPrimarySport}
            onChange={(event) => onCustomPrimarySport(event.target.value)}
            placeholder="e.g. Dodgeball, Boxing, Pickleball"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
          />
        </label>
      )}
      <div>
        <p className="text-sm font-bold text-[var(--navy)]">Sports you officiate</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_SPORTS.slice(0, 12).map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => onToggleSport(sport)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                selectedSports.includes(sport) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-slate-200 text-[var(--muted)]"
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Certification level
        <input value={certificationLevel} onChange={(event) => onCertificationLevel(event.target.value)} placeholder="Youth, varsity, NFHS, USSF, etc." className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
      </label>
    </div>
  );
}

function LocationAndAccount({
  email,
  baseCity,
  travelRadius,
  workRegions,
  password,
  onEmail,
  onBaseCity,
  onTravelRadius,
  onToggleRegion,
  onPassword,
  oauthMode = false,
}: {
  email: string;
  baseCity: string;
  travelRadius: string;
  workRegions: string[];
  password: string;
  onEmail: (value: string) => void;
  onBaseCity: (value: string) => void;
  onTravelRadius: (value: string) => void;
  onToggleRegion: (value: string) => void;
  onPassword: (value: string) => void;
  oauthMode?: boolean;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-[var(--navy)]">
        Email
        <input
          type="email"
          required
          readOnly={oauthMode}
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className={`mt-2 w-full rounded-xl border border-slate-200 px-4 py-3${oauthMode ? " bg-slate-50 text-[var(--muted)]" : ""}`}
        />
      </label>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Base city
        <input value={baseCity} onChange={(event) => onBaseCity(event.target.value)} placeholder="Phoenix, AZ" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
      </label>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Travel radius: {travelRadius || 0} miles
        <input type="range" min={5} max={150} value={travelRadius} onChange={(event) => onTravelRadius(event.target.value)} className="mt-3 w-full" />
      </label>
      <div>
        <p className="text-sm font-bold text-[var(--navy)]">Regions willing to work</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WORK_REGION_OPTIONS.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => onToggleRegion(region)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                workRegions.includes(region) ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-slate-200 text-[var(--muted)]"
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>
      {!oauthMode && (
        <label className="block text-sm font-bold text-[var(--navy)]">
          Create password
          <input type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters, with a letter and number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
      )}
    </div>
  );
}

function AccountFields({
  fullName,
  email,
  phone,
  password,
  onFullName,
  onEmail,
  onPhone,
  onPassword,
  oauthMode = false,
}: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  onFullName: (value: string) => void;
  onEmail: (value: string) => void;
  onPhone: (value: string) => void;
  onPassword: (value: string) => void;
  oauthMode?: boolean;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-[var(--navy)]">
        Legal name
        <input value={fullName} onChange={(event) => onFullName(event.target.value)} placeholder="First and last name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
      </label>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Email
        <input
          type="email"
          required
          readOnly={oauthMode}
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className={`mt-2 w-full rounded-xl border border-slate-200 px-4 py-3${oauthMode ? " bg-slate-50 text-[var(--muted)]" : ""}`}
        />
      </label>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Phone number
        <input type="tel" value={phone} onChange={(event) => onPhone(event.target.value)} placeholder="(555) 123-4567" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
      </label>
      {!oauthMode && (
        <label className="block text-sm font-bold text-[var(--navy)]">
          Create password
          <input type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters, with a letter and number" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" />
        </label>
      )}
    </div>
  );
}
