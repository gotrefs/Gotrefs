import Link from "next/link";
import siteData from "@/data/site-data.json";

type SD = typeof siteData;

export default function HomePage() {
  const d = siteData as SD;
  const hero = d.hero;
  const how = d.howItWorks;
  const trust = d.trustStrip;
  const cta = d.ctaBanner;

  return (
    <>
      <section className="relative flex min-h-[calc(100vh-56px)] flex-col justify-center overflow-hidden bg-[var(--navy)] px-4 pb-16 pt-12 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(240,78,35,0.12),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(26,46,68,0.8),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--orange)]/30 bg-[var(--orange)]/15 px-4 py-1.5 text-sm text-[#ff8a6a]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--orange)]" />
            {hero.badge}
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-none text-white sm:text-6xl">
            {hero.headline.line1}
            <br />
            <span className="text-[var(--orange)]">{hero.headline.line2Accent}</span>
            <br />
            {hero.headline.line3}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-light text-white/60">{hero.subtext}</p>
          <div className="mx-auto mt-10 grid max-w-lg gap-4 sm:grid-cols-2">
            <Link
              href="/auth/signup"
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-left text-white transition hover:bg-white/10"
            >
              <span className="text-2xl">{hero.ctaReferee.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold">{hero.ctaReferee.title}</span>
                <span className="text-sm text-white/60">{hero.ctaReferee.subtitle}</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/auth/signup"
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 px-5 py-4 text-left text-white transition hover:bg-[var(--orange)]/20"
            >
              <span className="text-2xl">{hero.ctaOrganizer.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold">{hero.ctaOrganizer.title}</span>
                <span className="text-sm text-white/60">{hero.ctaOrganizer.subtitle}</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="mt-14 flex flex-wrap justify-center gap-6 text-white/80">
            {hero.stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-3xl font-bold text-white">{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-[var(--orange)]">
            {how.sectionTag}
          </p>
          <h2 className="mt-2 text-center font-display text-4xl font-bold text-[var(--navy)]">{how.sectionTitle}</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-[var(--muted)]">{how.sectionSubtext}</p>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[var(--navy)] p-8 text-white">
              <div className="mb-6 flex items-center gap-2">
                <span className="text-2xl">{how.forReferees.icon}</span>
                <h3 className="font-display text-2xl font-bold">{how.forReferees.title}</h3>
              </div>
              <ol className="space-y-5">
                {how.forReferees.steps.map((step) => (
                  <li key={step.num} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] font-bold">
                      {step.num}
                    </span>
                    <div>
                      <p className="font-semibold">{step.title}</p>
                      <p className="text-sm text-white/60">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/dashboard/referee"
                className="mt-8 inline-block rounded-lg bg-[var(--orange)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Referee dashboard
              </Link>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-2">
                <span className="text-2xl">{how.forOrganizers.icon}</span>
                <h3 className="font-display text-2xl font-bold text-[var(--navy)]">{how.forOrganizers.title}</h3>
              </div>
              <ol className="space-y-5">
                {how.forOrganizers.steps.map((step) => (
                  <li key={step.num} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] font-bold text-white">
                      {step.num}
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--navy)]">{step.title}</p>
                      <p className="text-sm text-[var(--muted)]">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/dashboard/organizer"
                className="mt-8 inline-block rounded-lg border border-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
              >
                Organizer dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-white py-10">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8 px-4 text-sm text-[var(--slate)]">
          {trust.items.map((t) => (
            <span key={t.label} className="font-medium">
              ✓ {t.label}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-[var(--navy)] px-4 py-20 text-center text-white">
        <h2 className="font-display text-3xl font-bold">{cta.title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-white/60">{cta.subtext}</p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/auth/signup" className="rounded-lg bg-white px-6 py-3 font-semibold text-[var(--navy)]">
            {cta.primaryButton}
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            {cta.secondaryButton}
          </Link>
        </div>
      </section>

      <footer className="bg-[var(--navy)] px-4 py-10 text-sm text-white/40">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p>{d.footer.copyright}</p>
          <p>{d.footer.legalLine}</p>
        </div>
      </footer>
    </>
  );
}
