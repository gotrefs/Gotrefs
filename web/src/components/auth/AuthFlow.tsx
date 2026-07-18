"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { validatePasswordStrength } from "@/lib/auth/password";
import { BRAND_NAME } from "@/lib/brand";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { ALL_SPORTS, OTHER_SPORT_VALUE, sportPickerToStored } from "@/data/sports";
import { uploadRefSignupDocuments, submitRefVerificationForReview } from "@/lib/auth/upload-ref-signup-docs";
import { signupDashboardLabel, type SignupDashboardPath } from "@/lib/auth/email-confirmation";
import { formatHourlyRateRange } from "@/lib/pay-range";

const SIGNUP_HOURLY_RATE_FLOOR = 10;
const SIGNUP_HOURLY_RATE_CEILING = 150;

type AuthStep = "email" | "password" | "role" | "onboarding" | "verify-email" | "forgot-password";
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
  const [secondarySport, setSecondarySport] = useState("");
  const [certificationLevel, setCertificationLevel] = useState("");
  const [hourlyRateMin, setHourlyRateMin] = useState(String(SIGNUP_HOURLY_RATE_FLOOR));
  const [hourlyRateMax, setHourlyRateMax] = useState("75");
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
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<SignupDashboardPath>("/dashboard/referee");
  const [resendCooldown, setResendCooldown] = useState(false);
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
  const resolvedAdditionalSports =
    secondarySport.trim() && secondarySport !== resolvedPrimarySport && secondarySport !== OTHER_SPORT_VALUE
      ? [secondarySport.trim()]
      : [];

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
      const json = (await res.json()) as {
        error?: string;
        role?: "ref" | "organizer";
        redirect?: string;
      };
      if (!res.ok) {
        setError(json.error || "Invalid email or password.");
        return;
      }
      const next = searchParams.get("next");
      const destination =
        json.redirect ||
        (next && next !== "/dashboard" ? next : null) ||
        (json.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee");
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
    if (role === "ref" && wizardStep === 1) {
      const minRate = Number(hourlyRateMin);
      const maxRate = Number(hourlyRateMax);
      if (!Number.isFinite(minRate) || minRate < SIGNUP_HOURLY_RATE_FLOOR) {
        setError(`Set your minimum hourly rate to at least $${SIGNUP_HOURLY_RATE_FLOOR}.`);
        return;
      }
      if (!Number.isFinite(maxRate) || maxRate < minRate) {
        setError("Maximum hourly rate must be at least your minimum.");
        return;
      }
      if (maxRate > SIGNUP_HOURLY_RATE_CEILING) {
        setError(`Maximum hourly rate cannot exceed $${SIGNUP_HOURLY_RATE_CEILING}.`);
        return;
      }
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

  async function requestPasswordReset() {
    setError(null);
    setNotice(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setEmail(normalized);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.error || "Could not send the password reset email.");
        return;
      }
      setNotice(
        json.message ||
          "If an account exists for that email, we sent a link to set or reset your password."
      );
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationEmail() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pendingRedirect }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.error || "Could not resend the verification email.");
        return;
      }
      setNotice(json.message || "Verification email sent.");
      setResendCooldown(true);
      window.setTimeout(() => setResendCooldown(false), 60_000);
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
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
        additionalSports: resolvedAdditionalSports,
        certificationLevel: certificationLevel.trim() || undefined,
        rateMin: role === "ref" ? Number(hourlyRateMin) || SIGNUP_HOURLY_RATE_FLOOR : undefined,
        rateMax: role === "ref" ? Number(hourlyRateMax) || SIGNUP_HOURLY_RATE_FLOOR : undefined,
        rateType: role === "ref" ? "range" : undefined,
        rateUnit: role === "ref" ? "hour" : undefined,
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
      const json = (await res.json()) as {
        error?: string;
        redirect?: string;
        userId?: string | null;
        needsEmailConfirmation?: boolean;
        pendingRedirect?: SignupDashboardPath;
      };
      if (!res.ok) {
        setError(json.error || "Could not create your account.");
        return;
      }

      if (json.needsEmailConfirmation) {
        if (json.pendingRedirect) {
          setPendingRedirect(json.pendingRedirect);
        }
        if (role === "ref" && govIdFrontFile && govIdBackFile && certDocFile) {
          try {
            localStorage.setItem("gotrefs_pending_ref_docs", "1");
          } catch {
            // Non-fatal if storage is unavailable.
          }
          setNotice(
            "After you confirm your email, upload your verification documents from your referee dashboard."
          );
        }
        setStep("verify-email");
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
                additionalSports: resolvedAdditionalSports,
                certificationLevel: certificationLevel.trim() || "Youth / Recreational",
              }
            );
            await submitRefVerificationForReview();
          }
        } catch (submitError) {
          const detail =
            submitError instanceof Error ? submitError.message : "Could not submit verification.";
          setNotice(
            `Account created, but verification was not queued for review (${detail}). Ask your admin to run supabase/RUN_ADMIN_VERIFICATION_SETUP.sql in Supabase, then open your referee dashboard to resubmit.`
          );
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

        {step === "verify-email" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Almost there</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--navy)]">Confirm your email address</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                We sent a verification link to{" "}
                <span className="font-bold text-[var(--navy)]">{email}</span>. Open your inbox and click the link to
                finish creating your account.
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                After confirming, you&apos;ll go straight to your{" "}
                <span className="font-semibold text-[var(--navy)]">{signupDashboardLabel(pendingRedirect)}</span>{" "}
                dashboard.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>Check your spam or promotions folder if you do not see the email within a minute.</li>
              <li>The link expires after a while — use Resend below if needed.</li>
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void resendVerificationEmail()}
                disabled={loading || resendCooldown}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendCooldown ? "Email sent — wait a minute" : loading ? "Sending…" : "Resend verification email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setStep("email");
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-[var(--navy)]"
              >
                Wrong email?
              </button>
            </div>

            <p className="text-center text-sm text-[var(--muted)]">
              Already confirmed?{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setStep("password");
                }}
                className="font-semibold text-[var(--red)] underline"
              >
                Log in
              </button>
            </p>
          </div>
        )}

        {step === "email" && (
          <div className="space-y-4">
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
                className="w-full rounded-xl bg-gradient-to-r from-[var(--navy)] to-emerald-600 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
              <button
                type="button"
                onClick={startSignup}
                className="w-full rounded-xl border-2 border-[var(--navy)] bg-white px-5 py-4 text-base font-black uppercase tracking-wide text-[var(--navy)] transition hover:bg-slate-50"
              >
                Sign up
              </button>
              <p className="text-center text-sm text-[var(--muted)]">
                Already have an account but forgot your password?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    const normalized = email.trim().toLowerCase();
                    if (!normalized || !normalized.includes("@")) {
                      setError("Enter your email address first, then click Forgot password.");
                      return;
                    }
                    setEmail(normalized);
                    setStep("forgot-password");
                  }}
                  className="font-semibold text-[var(--red)] underline"
                >
                  Forgot password
                </button>
              </p>
            </form>
          </div>
        )}

        {step === "password" && (
          <div className="space-y-4">
            <form onSubmit={login} className="space-y-4">
              <button type="button" onClick={() => setStep("email")} className="text-sm font-bold text-[var(--muted)]">
                Back to email
              </button>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Existing account</p>
                <p className="mt-1 font-bold text-[var(--navy)]">{email}</p>
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
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setStep("forgot-password");
                }}
                className="w-full text-sm font-semibold text-[var(--red)] underline"
              >
                Forgot password?
              </button>
            </form>
          </div>
        )}

        {step === "forgot-password" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNotice(null);
                setStep("email");
              }}
              className="text-sm font-bold text-[var(--muted)]"
            >
              Back to email
            </button>
            <div className="rounded-2xl bg-slate-50 p-4">
              <h2 className="text-xl font-black text-[var(--navy)]">Forgot your password?</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                We&apos;ll email you a link to set or reset your password. This also works if your
                account was originally created with Google.
              </p>
            </div>
            <label className="block text-sm font-bold text-[var(--navy)]">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            </label>
            <button
              type="button"
              onClick={() => void requestPasswordReset()}
              disabled={loading}
              className="w-full rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send password reset link"}
            </button>
          </div>
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
                <label
                  className={`relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition ${
                    photoSelected
                      ? "border-green-400 bg-green-50"
                      : "border-slate-200 hover:border-[var(--blue)]/50"
                  }`}
                >
                  <span
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full text-xs font-black ${
                      photoSelected ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {photoSelected ? (
                      <span className="text-2xl" aria-hidden>
                        ✓
                      </span>
                    ) : (
                      "Photo"
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[var(--navy)]">
                      {photoSelected ? "Profile photo uploaded" : "Upload profile photo"}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {photoSelected
                        ? "Green check means you’re set — tap to replace anytime."
                        : "Circle preview template. You can update this later."}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    onChange={(event) => setPhotoSelected(Boolean(event.target.files?.[0]))}
                  />
                </label>
              </div>
            )}

            {role === "ref" && wizardStep === 1 && (
              <SportsAndCerts
                primarySport={primarySport}
                customPrimarySport={customPrimarySport}
                secondarySport={secondarySport}
                certificationLevel={certificationLevel}
                hourlyRateMin={hourlyRateMin}
                hourlyRateMax={hourlyRateMax}
                onPrimarySport={setPrimarySport}
                onCustomPrimarySport={setCustomPrimarySport}
                onSecondarySport={setSecondarySport}
                onCertificationLevel={setCertificationLevel}
                onHourlyRateMin={setHourlyRateMin}
                onHourlyRateMax={setHourlyRateMax}
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
  const uploaded = Boolean(file);
  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-2xl border-2 border-dashed p-4 text-sm transition ${
        uploaded
          ? "border-green-400 bg-green-50 hover:border-green-500"
          : "border-[var(--blue)]/35 bg-[var(--blue)]/5 hover:border-[var(--blue)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-bold text-[var(--navy)]">{label}</span>
          <span className="mt-1 block text-xs text-[var(--muted)]">JPG, PNG, or PDF</span>
        </div>
        {uploaded && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500 text-lg font-black text-white shadow-sm"
            aria-label="Uploaded"
          >
            ✓
          </span>
        )}
      </div>
      {uploaded ? (
        <>
          <span className="mt-3 font-semibold text-green-800">Uploaded · {file!.name}</span>
          <span className="mt-1 text-xs text-green-700/80">Tap to replace</span>
        </>
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
  primarySport,
  customPrimarySport,
  secondarySport,
  certificationLevel,
  hourlyRateMin,
  hourlyRateMax,
  onPrimarySport,
  onCustomPrimarySport,
  onSecondarySport,
  onCertificationLevel,
  onHourlyRateMin,
  onHourlyRateMax,
}: {
  primarySport: string;
  customPrimarySport: string;
  secondarySport: string;
  certificationLevel: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  onPrimarySport: (sport: string) => void;
  onCustomPrimarySport: (value: string) => void;
  onSecondarySport: (sport: string) => void;
  onCertificationLevel: (value: string) => void;
  onHourlyRateMin: (value: string) => void;
  onHourlyRateMax: (value: string) => void;
}) {
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

  return (
    <div className="space-y-4">
      <label className="block text-sm font-bold text-[var(--navy)]">
        Primary sport
        <select
          value={primarySport}
          onChange={(event) => {
            const next = event.target.value;
            onPrimarySport(next);
            if (secondarySport === next) onSecondarySport("");
          }}
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
        >
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
            placeholder="e.g. Dodgeball"
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
          />
        </label>
      )}
      <label className="block text-sm font-bold text-[var(--navy)]">
        Secondary sport <span className="font-medium text-[var(--muted)]">(optional)</span>
        <select
          value={secondarySport}
          onChange={(event) => onSecondarySport(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
        >
          <option value="">None — primary sport only</option>
          {ALL_SPORTS.filter((sport) => sport !== primarySport).map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[var(--muted)]">
        Add another sport you also officiate if you want. You can skip this and continue.
      </p>
      <label className="block text-sm font-bold text-[var(--navy)]">
        Certification level
        <input
          value={certificationLevel}
          onChange={(event) => onCertificationLevel(event.target.value)}
          placeholder="Youth, varsity, NFHS, USSF, etc."
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
        />
      </label>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-[var(--navy)]">Your hourly rate range</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Drag both ends of the slider. Event organizers only see your GotREFS ID until you accept a game.
        </p>
        <p className="mt-3 text-lg font-black text-[var(--navy)]">
          {formatHourlyRateRange(minVal, maxVal)}
        </p>
        <div className="dual-range relative mt-6 h-8">
          <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--navy)]"
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
        <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--muted)]">
          <span>${SIGNUP_HOURLY_RATE_FLOOR}/hr</span>
          <span>
            ${minVal} – ${maxVal}/hr
          </span>
          <span>${SIGNUP_HOURLY_RATE_CEILING}/hr</span>
        </div>
      </div>
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
