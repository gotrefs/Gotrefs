"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowCircleIcon, CheckBullet } from "./CheckBullet";

export type FeatureTab = {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
};

export function FeatureTabs({ tabs, sectionTitle, sectionTitleAccent }: {
  tabs: FeatureTab[];
  sectionTitle: string;
  sectionTitleAccent: string;
}) {
  const [active, setActive] = useState(0);
  const current = tabs[active];
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section className="section-padding bg-[var(--grey-light)]">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-3xl font-bold capitalize text-[var(--blue-text)] md:text-4xl">
          {sectionTitle}{" "}
          <span className="text-[var(--red)]">{sectionTitleAccent}</span>
        </h2>

        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-[var(--border)]">
            <h3 className="mb-3 text-xl font-bold uppercase tracking-wide text-[var(--blue-text)] md:text-2xl">
              {current.title}
            </h3>
            <p className="mb-6 text-[var(--muted)]">{current.description}</p>
            <div className="grid gap-0 sm:grid-cols-2">
              {current.bullets.map((b) => (
                <CheckBullet key={b}>{b}</CheckBullet>
              ))}
            </div>
            <Link href={current.ctaHref} className="btn-primary mt-8">
              {current.ctaLabel}
              <ArrowCircleIcon />
            </Link>
          </div>

          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    i === active
                      ? "bg-[var(--blue)] text-white"
                      : "bg-white text-[var(--blue-text)] ring-1 ring-[var(--border)] hover:bg-[var(--grey-light)]"
                  }`}
                >
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-[var(--blue)] p-8 text-white">
              <p className="text-sm font-bold uppercase tracking-widest text-white/70">
                {pad(active + 1)} – {pad(tabs.length)}
              </p>
              <p className="mt-4 text-lg font-semibold">{current.title}</p>
              <p className="mt-2 text-white/75">{current.description}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Previous feature"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--blue-text)] hover:bg-[var(--grey-light)] disabled:opacity-40"
            disabled={active === 0}
            onClick={() => setActive((a) => Math.max(0, a - 1))}
          >
            ←
          </button>
          <p className="text-sm font-bold text-[var(--blue-text)]">
            {pad(active + 1)} – {pad(tabs.length)}
          </p>
          <button
            type="button"
            aria-label="Next feature"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--blue-text)] hover:bg-[var(--grey-light)] disabled:opacity-40"
            disabled={active === tabs.length - 1}
            onClick={() => setActive((a) => Math.min(tabs.length - 1, a + 1))}
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
