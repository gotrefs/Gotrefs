import Link from "next/link";
import siteData from "@/data/site-data.json";
import { HeroVideoBackground } from "@/components/HeroVideoBackground";

type SD = typeof siteData;

export default function HomePage() {
  const d = siteData as SD;
  const hero = d.hero;
  const how = d.howItWorks;
  const trust = d.trustStrip;
  const cta = d.ctaBanner;

  return (
    <>
      <section className="relative flex min-h-[calc(100vh-56px)] flex-col justify-center overflow-hidden bg-white px-4 pb-16 pt-12 text-center">
        <HeroVideoBackground />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/55 via-white/45 to-white/70"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--blue)]/25 bg-[var(--blue)]/5 px-4 py-1.5 text-sm text-[var(--blue)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--red)]" />
            {hero.badge}
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-none text-[var(--blue)] sm:text-6xl">
            {hero.headline.line1}
            <br />
            <span className="text-[var(--red)]">{hero.headline.line2Accent}</span>
            <br />
            <span className="text-[var(--blue)]">{hero.headline.line3}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light text-[var(--slate)]">{hero.subtext}</p>
          <div className="mx-auto mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
            <Link
              href="/auth/signup?role=ref"
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--blue)]/20 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[var(--blue)]/40"
            >
              <span className="text-2xl">{hero.ctaReferee.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold text-[var(--blue)]">{hero.ctaReferee.title}</span>
                <span className="text-sm text-[var(--muted)]">{hero.ctaReferee.subtitle}</span>
              </span>
              <span className="text-[var(--red)]" aria-hidden>
                →
              </span>
            </Link>
            <Link
              href="/auth/signup?role=organizer"
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-light)] px-5 py-4 text-left transition hover:border-[var(--red)]/50"
            >
              <span className="text-2xl">{hero.ctaOrganizer.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold text-[var(--red)]">{hero.ctaOrganizer.title}</span>
                <span className="text-sm text-[var(--slate)]">{hero.ctaOrganizer.subtitle}</span>
              </span>
              <span className="text-[var(--blue)]" aria-hidden>
                →
              </span>
            </Link>
          </div>
          <div className="mt-14 flex flex-wrap justify-center gap-6">
            {hero.stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-3xl font-bold text-[var(--red)]">{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--blue)]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-[var(--red)]">
            {how.sectionTag}
          </p>
          <h2 className="mt-2 text-center font-display text-4xl font-bold text-[var(--blue)]">{how.sectionTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-[var(--muted)]">{how.sectionSubtext}</p>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--blue)]/15 bg-[var(--blue)] p-8 text-white">
              <div className="mb-6 flex items-center gap-2">
                <span className="text-2xl">{how.forReferees.icon}</span>
                <h3 className="font-display text-2xl font-bold">{how.forReferees.title}</h3>
              </div>
              <ol className="space-y-5">
                {how.forReferees.steps.map((step) => (
                  <li key={step.num} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--red)] font-bold">
                      {step.num}
                    </span>
                    <div>
                      <p className="font-semibold">{step.title}</p>
                      <p className="text-sm text-white/70">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/auth/signup?role=ref"
                className="mt-8 inline-block rounded-lg bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Join as a Referee
              </Link>
            </div>
            <div className="rounded-2xl border border-[var(--red)]/20 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <span className="text-2xl">{how.forOrganizers.icon}</span>
                <h3 className="font-display text-2xl font-bold text-[var(--blue)]">{how.forOrganizers.title}</h3>
              </div>
              <ol className="space-y-5">
                {how.forOrganizers.steps.map((step) => (
                  <li key={step.num} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--blue)] font-bold text-white">
                      {step.num}
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--blue)]">{step.title}</p>
                      <p className="text-sm text-[var(--muted)]">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/auth/signup?role=organizer"
                className="mt-8 inline-block rounded-lg border-2 border-[var(--red)] px-5 py-2.5 text-sm font-semibold text-[var(--red)]"
              >
                Post Your Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white py-10">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8 px-4 text-sm text-[var(--blue)]">
          {trust.items.map((t) => (
            <span key={t.label} className="font-medium">
              <span className="text-[var(--red)]">✓</span> {t.label}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-[var(--blue)] px-4 py-20 text-center text-white">
        <h2 className="font-display text-3xl font-bold">{cta.title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-white/75">{cta.subtext}</p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/auth/signup?role=ref" className="rounded-lg bg-[var(--red)] px-6 py-3 font-semibold text-white">
            {cta.primaryButton}
          </Link>
          <Link
            href="/auth/signup?role=organizer"
            className="rounded-lg border border-white/40 bg-white px-6 py-3 font-semibold text-[var(--blue)]"
          >
            {cta.secondaryButton}
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-white px-4 py-10 text-sm text-[var(--muted)]">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-4 sm:flex-row">
          <p>{d.footer.copyright}</p>
          <p>{d.footer.legalLine}</p>
        </div>
      </footer>
    </>
  );
}
