"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured()) {
      setError(SUPABASE_SETUP_HINT);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError(
        "Could not reach Supabase (Failed to fetch). Check web/.env.local and restart npm run dev."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl font-bold text-[var(--navy)]">Log in</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        No account?{" "}
        <Link href="/auth/signup" className="text-[var(--orange)] underline">
          Sign up
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--orange)] py-2.5 font-medium text-white hover:opacity-95 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
