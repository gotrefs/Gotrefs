"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/config";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (searchParams.get("error") !== "confirmation_failed") return null;
    const reason = searchParams.get("reason");
    if (reason && reason !== "missing_code") {
      return `Email confirmation failed: ${decodeURIComponent(reason)}. Try logging in — your email may already be confirmed.`;
    }
    return "Email confirmation link expired or could not be verified. Try logging in, or sign up again.";
  });
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
      const dest =
        next && next !== "/dashboard"
          ? next
          : json.redirect ||
            (json.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee");
      window.location.href = dest;
    } catch {
      setError(
        "Could not reach Supabase. Check web/.env.local and restart npm run dev."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold text-[var(--blue-text)]">Log in</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        No account?{" "}
        <Link href="/auth/signup" className="text-[var(--red)] underline">
          Sign up
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-[var(--border)] px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      </div>
    </div>
  );
}
