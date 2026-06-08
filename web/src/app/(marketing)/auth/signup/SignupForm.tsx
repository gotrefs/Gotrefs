"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";
import { validatePasswordStrength } from "@/lib/auth/password";

export function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [role, setRole] = useState<"ref" | "organizer">("ref");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = searchParams.get("role");
    if (r === "organizer" || r === "ref") setRole(r);
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_SETUP_HINT);
      return;
    }

    if (role === "organizer" && !organizationName.trim()) {
      setError("Organization name is required for organizers.");
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
      if (json.needsEmailConfirmation) {
        setInfo("Check your email to confirm your account, then log in.");
        return;
      }
      const dest =
        json.redirect ||
        (json.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee");
      window.location.href = dest;
    } catch {
      setError(
        "Could not reach Supabase (Failed to fetch). On Vercel: confirm NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set for Production, then Redeploy."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-[var(--blue-text)]">Create account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-[var(--red)] underline">
          Log in
        </Link>
      </p>
      {!isSupabaseConfigured() && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {SUPABASE_SETUP_HINT}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
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
          <span className="font-medium text-[var(--blue-text)]">I am a…</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ref" | "organizer")}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          >
            <option value="ref">Referee</option>
            <option value="organizer">Event organizer</option>
          </select>
        </label>
        {role === "organizer" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--blue-text)]">Organization name</span>
            <input
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Westside Youth Basketball"
              className="rounded-lg border border-[var(--border)] px-3 py-2"
            />
          </label>
        )}
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
      </div>
    </div>
  );
}
