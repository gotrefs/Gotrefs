import type { Metadata } from "next";
import Link from "next/link";
import { BrandName } from "@/components/BrandName";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PolicyLinksPanel } from "@/components/marketing/PolicyLinksPanel";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Policies | ${BRAND_NAME}`,
  description: `Review ${BRAND_NAME} standards, terms, and program details.`,
};

export default function PoliciesPage() {
  return (
    <>
      <MarketingHeader />
      <main className="bg-slate-50">
        <section className="hero-arbiter-bg px-4 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Link href="/" className="text-sm font-bold text-white/75 hover:text-white">
              Back to home
            </Link>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-[var(--red)]">Legal & program</p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              <BrandName /> Policies
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              Review our standards, terms, and program details. Click any document to read the full text.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <PolicyLinksPanel variant="section" />
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
