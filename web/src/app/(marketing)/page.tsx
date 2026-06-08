import Link from "next/link";
import siteData from "@/data/site-data.json";
import { HeroVideoShowcase } from "@/components/marketing/HeroVideoShowcase";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { SecondViewport } from "@/components/marketing/SecondViewport";

type SD = typeof siteData;

export default function HomePage() {
  const d = siteData as SD;
  const hero = d.hero;
  const stats = d.statsBanner;
  const seeHow = d.seeHowItWorks;
  const apart = d.apart;
  const faqs = d.faqs;
  const cta = d.ctaBanner;

  return (
    <>
      <MarketingHeader />

      {/* Screen 1 — headline left, full video right */}
      <section className="hero-arbiter-bg hero-fullscreen flex items-center text-white">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 lg:grid-cols-2 lg:gap-12">
          <div id="for-referees">
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl lg:text-[3.25rem]">
              <span className="block text-white">The Referee Marketplace</span>
              <span className="mt-1 block text-[var(--red)]">For Every Sport</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85 md:text-base lg:text-lg">
              {hero.subtext}
            </p>
            <div className="mt-6" id="for-organizers">
              <Link
                href="mailto:hello@gotrefs.org?subject=GoTRefs%20Demo%20Request"
                className="btn-demo-hero"
              >
                Book a Demo
              </Link>
            </div>
          </div>
          <div className="flex h-[min(50vh,400px)] items-center justify-center lg:h-[min(72vh,calc(100svh-10rem))]">
            <HeroVideoShowcase fitContainer className="h-full w-full" />
          </div>
        </div>
      </section>

      {/* Screen 2 — Numbers That Matter + See How (one viewport) */}
      <SecondViewport
        statsTitle={stats.title}
        statsSubtext={stats.subtext}
        stats={stats.stats}
        seeHowTitle={seeHow.title}
        seeHowBody={seeHow.body}
        seeHowCtaLabel={seeHow.ctaLabel}
        seeHowCtaHref={seeHow.ctaHref}
      />

      {/* Screen 3 — What sets us apart */}
      <section className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="mb-8 text-center text-2xl font-bold uppercase tracking-wide text-[#1b2132] md:text-3xl">
            {apart.title}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {apart.items.map((item) => (
              <div key={item.title}>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--red-light)] text-lg text-[var(--red)]">
                  {item.icon}
                </div>
                <h3 className="mb-1 text-base font-bold uppercase text-[#1b2132]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted)]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screen 4 — Trust + FAQ */}
      <section className="viewport-screen flex flex-col justify-center bg-white px-4" id="faq">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-semibold text-[#1b2132] md:text-sm">
            {d.trustStrip.items.map((t) => (
              <span key={t.label}>
                <span className="text-[var(--red)]">✓</span> {t.label}
              </span>
            ))}
          </div>
          <h2 className="mb-6 text-center text-2xl font-bold text-[#1b2132] md:text-3xl">FAQs</h2>
          <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-4 py-3 md:px-5 md:py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#1b2132] marker:content-none group-open:text-[var(--red)] md:text-base">
                  {faq.q}
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] md:text-sm">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Screen 5 — CTA */}
      <section className="hero-arbiter-bg viewport-screen flex flex-col items-center justify-center px-4 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold md:text-3xl">{cta.title}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--grey-light)] md:text-base">{cta.subtext}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup?role=ref" className="btn-primary">
              {cta.primaryButton}
            </Link>
            <Link href="/auth/signup?role=organizer" className="btn-outline-light">
              {cta.secondaryButton}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
