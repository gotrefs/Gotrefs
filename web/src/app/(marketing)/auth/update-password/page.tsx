"use client";

import { useState } from "react";
import { validatePasswordStrength } from "@/lib/auth/password";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your reset link expired. Request a new password reset from the login page.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      const adminRes = await fetch("/api/auth/admin-check");
      const adminJson = (await adminRes.json()) as { isAdmin?: boolean };
      window.location.assign(adminJson.isAdmin ? "/dashboard/admin" : "/dashboard");
    } catch {
      setError("Could not update your password. Try requesting a new reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[72vh] max-w-xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
        <h1 className="text-2xl font-black text-[var(--navy)]">Set your password</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Choose a password for your GotREFS account. After saving, you can log in with email and password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-[var(--navy)]">
            New password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters, with a letter and number"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </label>
          <label className="block text-sm font-bold text-[var(--navy)]">
            Confirm password
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </label>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--navy)] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>
      </section>
    </main>
  );
}
