"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordField } from "@/components/auth/PasswordField";
import { POST_SIGNUP_NEXT_KEY } from "@/components/find-refs/RequestRefForm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  "mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none focus:border-neutral-900";

/** Organizer signup in one screen: name, phone, email, password. No card. */
export function OrganizerQuickSignupForm({ next }: { next: string | null }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);

  function validate(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Enter your first and last name.";
    if (phone.replace(/\D/g, "").length < 10) return "Enter a phone number with area code.";
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return "Password needs at least one letter and one number.";
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "organizer",
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
          termsAccepted: true,
          acceptedTermsSlug: "event-organizer-terms",
        }),
      });
      const json = (await res.json()) as { error?: string; needsEmailConfirmation?: boolean };
      if (!res.ok) {
        setError(json.error || "Could not create your account. Try again.");
        setSaving(false);
        return;
      }
      if (next) {
        try {
          // After email confirmation the dashboard sends them back to what they were doing.
          localStorage.setItem(POST_SIGNUP_NEXT_KEY, JSON.stringify({ path: next, at: Date.now() }));
        } catch {
          // ignore
        }
      }
      if (json.needsEmailConfirmation) {
        setConfirmEmail(email.trim().toLowerCase());
        setSaving(false);
        return;
      }
      window.location.assign(next ?? "/find-refs");
    } catch {
      setError("Could not reach the server. Try again in a moment.");
      setSaving(false);
    }
  }

  async function resend() {
    if (!confirmEmail) return;
    setResent(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmEmail }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setResent(res.ok ? "Sent. Check your inbox (and spam)." : json.error || "Could not resend yet. Try again shortly.");
    } catch {
      setResent("Could not resend yet. Try again shortly.");
    }
  }

  if (confirmEmail) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white p-7 text-center shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="text-4xl" aria-hidden>
          ✉️
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">Check your email</h1>
        <p className="mt-2 text-neutral-600">
          We sent a link to <span className="font-semibold text-neutral-900">{confirmEmail}</span>. Open it to
          finish creating your account{next ? " and pick up right where you left off" : ""}. Can&apos;t find
          it? Check your junk or spam folder.
        </p>
        <button type="button" onClick={() => void resend()} className="mt-5 text-sm font-semibold text-neutral-900 underline">
          Resend the email
        </button>
        {resent && <p className="mt-2 text-sm text-neutral-600">{resent}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mx-auto max-w-md rounded-3xl bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8"
    >
      <h1 className="text-2xl font-semibold text-neutral-900">Create your account</h1>
      <p className="mt-1 text-sm text-neutral-600">Free to join. No card needed until you book a REF.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-neutral-900">
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} autoComplete="given-name" />
        </label>
        <label className="block text-sm font-semibold text-neutral-900">
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} autoComplete="family-name" />
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-neutral-900">
        Phone number
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} autoComplete="tel" placeholder="(555) 555-5555" />
      </label>
      <label className="mt-4 block text-sm font-semibold text-neutral-900">
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" placeholder="you@example.com" />
      </label>
      <div className="mt-4">
        <PasswordField
          label="Password"
          labelClassName="block text-sm font-semibold text-neutral-900"
          inputClassName="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-3.5 pr-14 text-[15px] text-neutral-900 outline-none focus:border-neutral-900"
          className="!mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-neutral-500">At least 8 characters, with a letter and a number.</p>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-60"
      >
        {saving ? "Creating account…" : "Create account"}
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-neutral-500">
        By creating an account you agree to the{" "}
        <Link href="/policies/event-organizer-terms" target="_blank" className="underline">
          Organizer Terms
        </Link>
        , Privacy Policy and Payment &amp; Fee Policy.
      </p>
      <p className="mt-5 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href={next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"} className="font-semibold text-neutral-900 underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-neutral-600">
        Are you a REFeree?{" "}
        <Link href="/join" className="font-semibold text-neutral-900 underline">
          Join as a REF
        </Link>
      </p>
    </form>
  );
}
