"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"ref" | "organizer">("ref");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_SETUP_HINT);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data.session) {
        window.location.href = "/dashboard";
        return;
      }
      setInfo("Check your email to confirm your account, then log in.");
    } catch {
      setError(
        "Could not reach Supabase (Failed to fetch). Check web/.env.local has your real project URL and anon key, then restart the dev server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-[var(--navy)]">Create account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-[var(--orange)] underline">
          Log in
        </Link>
      </p>
      {!isSupabaseConfigured() && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {SUPABASE_SETUP_HINT}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--navy)]">Full name</span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--navy)]">I am a…</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ref" | "organizer")}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          >
            <option value="ref">Referee</option>
            <option value="organizer">Event organizer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--navy)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--navy)]">Password</span>
          <input
            type="password"
            required
            minLength={8}
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
          className="rounded-lg bg-[var(--orange)] py-2.5 font-medium text-white hover:opacity-95 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
