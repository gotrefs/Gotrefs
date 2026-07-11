import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandName } from "@/components/BrandName";
import siteData from "@/data/site-data.json";
import { normalizeBrandInText } from "@/lib/brand";
import { ApartSection } from "@/components/marketing/ApartSection";
import { HeroVideoShowcase } from "@/components/marketing/HeroVideoShowcase";
import { MarketingFaqSection } from "@/components/marketing/MarketingFaqSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { OrganizerBenefitsSection } from "@/components/marketing/OrganizerBenefitsSection";
import { OrganizerProfileShowcaseSection } from "@/components/marketing/OrganizerProfileShowcaseSection";
import { RefereeDigitalCardSection } from "@/components/marketing/RefereeDigitalCardSection";
import { VerifiedRefCardSection } from "@/components/marketing/VerifiedRefCardSection";

type SD = typeof siteData;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const code = typeof params.code === "string" ? params.code : null;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : null;
  const type = typeof params.type === "string" ? params.type : null;
  if (code || (tokenHash && type)) {
    const callbackParams = new URLSearchParams();
    if (code) callbackParams.set("code", code);
    if (tokenHash) callbackParams.set("token_hash", tokenHash);
    if (type) callbackParams.set("type", type);
    callbackParams.set("next", "/dashboard");
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const d = siteData as SD;
  const hero = d.hero;
  const apart = d.apart;
  const cta = d.ctaBanner;

  return (
    <>
      {/* First viewport: header + hero share one full-height blue panel (no white strip) */}
      <div className="hero-arbiter-bg flex min-h-dvh flex-col">
        <MarketingHeader />

        <section className="flex min-h-0 flex-1 items-center text-white">
          <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-1 items-center gap-4 px-4 py-4 sm:gap-6 sm:py-6 lg:grid-cols-2 lg:gap-12 lg:py-0">
            <div className="min-h-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)] sm:text-sm sm:tracking-[0.22em]">
                <BrandName /> Marketplace
              </p>
              <h1 className="mt-3 text-[2.35rem] font-black leading-[1.02] tracking-tight sm:mt-4 sm:text-5xl md:text-6xl">
                The Referee Marketplace For Every Sport
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:mt-5 md:text-lg md:leading-7">
                {hero.subtext}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <Link href="/auth/signup?role=ref" className="btn-primary w-full sm:w-auto">
                  Get verified as a ref
                </Link>
                <Link href="/auth/signup?role=organizer" className="btn-outline-light w-full sm:w-auto">
                  I need refs
                </Link>
              </div>
            </div>
            <div className="flex h-[min(32svh,240px)] min-h-0 items-center justify-center sm:h-[min(40vh,320px)] lg:h-full lg:max-h-[min(70vh,520px)]">
              <HeroVideoShowcase fitContainer className="h-full w-full" />
            </div>
          </div>
        </section>
      </div>

      <VerifiedRefCardSection />
      <RefereeDigitalCardSection />
      <OrganizerBenefitsSection />
      <OrganizerProfileShowcaseSection />

      <ApartSection title={apart.title} items={apart.items} />

      {/* FAQ */}
      <MarketingFaqSection />

      {/* Screen 5 — CTA */}
      <section className="hero-arbiter-bg viewport-screen flex flex-col items-center justify-center px-4 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold md:text-3xl">{cta.title}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--grey-light)] md:text-base">
            {normalizeBrandInText(cta.subtext)}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup?role=ref" className="btn-primary w-full sm:w-auto">
              {cta.primaryButton}
            </Link>
            <Link href="/auth/signup?role=organizer" className="btn-outline-light w-full sm:w-auto">
              {cta.secondaryButton}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
