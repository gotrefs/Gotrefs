"use client";

import Link from "next/link";
import { useState } from "react";

const POPULAR = ["Basketball", "Soccer", "Flag Football", "Volleyball", "Baseball", "Softball"];

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none focus:border-neutral-900";

export function QuickRefFinishForm({
  initialFirstName,
  initialLastName,
  email,
  sports,
}: {
  initialFirstName: string;
  initialLastName: string;
  email: string;
  sports: string[];
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [sport, setSport] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const popular = POPULAR.filter((s) => sports.includes(s));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Add your first and last name.");
    if (!sport) return setError("Pick the sport you REFeree.");
    if (!terms) return setError("Accept the REFeree terms to continue.");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/quick-ref-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, primarySport: sport, termsAccepted: true }),
      });
      const json = (await res.json()) as { error?: string; redirect?: string };
      if (!res.ok) throw new Error(json.error || "Could not finish signup.");
      window.location.assign(json.redirect || "/dashboard/referee");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish signup.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-3xl bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8">
      <h1 className="text-2xl font-semibold text-neutral-900">
        {initialFirstName ? `Welcome, ${initialFirstName}!` : "Almost there"}
      </h1>
      <p className="mt-1 text-sm text-neutral-600">
        One quick step{email ? ` for ${email}` : ""}, then you can browse games near you.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-neutral-900">First name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`mt-1.5 ${inputClass}`} autoComplete="given-name" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-neutral-900">Last name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={`mt-1.5 ${inputClass}`} autoComplete="family-name" />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-neutral-900">What sport do you REFeree?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {popular.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              aria-pressed={sport === s}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                sport === s
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={popular.includes(sport) ? "" : sport}
          onChange={(e) => setSport(e.target.value)}
          className={`mt-3 ${inputClass}`}
          aria-label="Other sport"
        >
          <option value="">Other sport…</option>
          {sports
            .filter((s) => !popular.includes(s))
            .map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </fieldset>

      <label className="mt-6 flex items-start gap-3 text-sm text-neutral-700">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--navy)]" />
        <span>
          I agree to the{" "}
          <Link href="/policies/referee-official-terms" target="_blank" className="font-semibold underline">
            REFeree Terms
          </Link>
          , Privacy Policy and Community Standards.
        </span>
      </label>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="mt-6 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-60"
      >
        {saving ? "Setting up…" : "Find games near me"}
      </button>
      <p className="mt-3 text-center text-xs text-neutral-500">
        You&apos;ll verify your ID and certification when you request your first game.
      </p>
    </form>
  );
}
