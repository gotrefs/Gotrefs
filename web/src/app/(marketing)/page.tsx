import Link from "next/link";
import siteData from "@/data/site-data.json";
import { ApartSection } from "@/components/marketing/ApartSection";
import { HeroVideoShowcase } from "@/components/marketing/HeroVideoShowcase";
import { MarketingFaqSection } from "@/components/marketing/MarketingFaqSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { VerifiedRefCardSection } from "@/components/marketing/VerifiedRefCardSection";

type SD = typeof siteData;

export default function HomePage() {
  const d = siteData as SD;
  const hero = d.hero;
  const apart = d.apart;
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
                href="mailto:hello@gotrefs.org?subject=GotREFS%20Demo%20Request"
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

      {/* Screen 2 — Verified ref digital player card */}
      <VerifiedRefCardSection />

      {/* Screen 3 — What sets us apart */}
      <ApartSection title={apart.title} items={apart.items} />

      {/* Screen 4 — FAQ */}
      <MarketingFaqSection />

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
