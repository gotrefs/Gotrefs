"use client";

import Link from "next/link";
import { useState } from "react";

export function LandingAuthPopup() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <section
        className="relative grid w-full max-w-5xl overflow-hidden rounded-xl bg-white text-[var(--navy)] shadow-2xl md:grid-cols-[1.05fr_1fr]"
        role="dialog"
        aria-modal="true"
        aria-label="Create a GotREFS account"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 px-3 py-1 text-sm font-black text-[var(--navy)] shadow-sm transition-all duration-200 hover:bg-white"
          aria-label="Close signup popup"
        >
          x
        </button>

        <div className="relative min-h-[340px] overflow-hidden bg-[var(--red)] p-8 text-white md:min-h-[620px] md:p-10">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: "url('/gotrefs-referee-cta.png')" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--red)]/95 via-[var(--red)]/35 to-[var(--red)]/90" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">Success starts here</h2>
              <ul className="mt-8 space-y-5 text-lg font-black leading-7">
                <li>✓ Find verified referees faster</li>
                <li>✓ Post games and staff events in minutes</li>
                <li>✓ Browse local gigs across every sport</li>
              </ul>
            </div>
            <p className="mt-10 max-w-sm rounded-2xl bg-black/35 p-4 text-sm font-semibold leading-6 text-white/90 backdrop-blur">
              GotREFS connects organizers and officials in one marketplace built for trust, speed, and clean scheduling.
            </p>
          </div>
        </div>

        <div className="flex items-center p-8 md:p-10">
          <div className="w-full">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Create a new account</h1>
            <p className="mt-3 text-base text-[var(--slate)]">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-bold text-[var(--navy)] underline">
                Sign in
              </Link>
            </p>

            <div className="mt-10 text-center">
              <Link href="/auth/signup" className="text-sm font-bold text-[var(--navy)] underline">
                Sign up using email
              </Link>
            </div>

            <p className="mt-4 text-center text-sm font-semibold text-slate-500">
              Additional verification may be required at a later stage.
            </p>

            <p className="mt-28 text-xs leading-5 text-slate-500 md:mt-32">
              By joining GotREFS, you agree to our{" "}
              <Link href="/#faq" className="font-bold text-emerald-700 underline">
                Terms of Service
              </Link>{" "}
              and acknowledge that we use data to operate your marketplace account.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
