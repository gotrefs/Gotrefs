import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandName } from "@/components/BrandName";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { getPolicyBySlug, POLICY_DOCUMENTS } from "@/data/policies";
import { BRAND_NAME, normalizeBrandInText } from "@/lib/brand";
type PolicyPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return POLICY_DOCUMENTS.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);
  return {
    title: policy ? `${normalizeBrandInText(policy.title)} | ${BRAND_NAME}` : `Policy | ${BRAND_NAME}`,
    description: policy?.summary,
  };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const policy = getPolicyBySlug(slug);
  if (!policy) notFound();

  return (
    <>
      <MarketingHeader />
      <main className="bg-slate-50">
        <section className="hero-arbiter-bg px-4 py-16 text-white">
          <div className="mx-auto max-w-4xl">
            <Link href="/policies" className="text-sm font-bold text-white/75 hover:text-white">
              Back to all policies
            </Link>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-[var(--red)]">
              <BrandName /> Policy
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              {normalizeBrandInText(policy.title)}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/80 sm:text-base">
              {normalizeBrandInText(policy.summary)}
            </p>            <p className="mt-4 text-sm font-bold text-white/70">{policy.effectiveDate}</p>
          </div>
        </section>

        <article className="mx-auto max-w-4xl px-4 py-12">
          <div className="space-y-5">
            {policy.sections.map((section) => (
              <section key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-[var(--navy)]">{normalizeBrandInText(section.title)}</h2>
                {section.body?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {normalizeBrandInText(paragraph)}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
                    {section.bullets.map((item) => (
                      <li key={item}>{normalizeBrandInText(item)}</li>                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-[var(--navy)]/10 bg-white p-6 text-sm text-[var(--muted)] shadow-sm">
            Questions about this policy? Email{" "}
            <a href={`mailto:${policy.contactEmail}`} className="font-bold text-[var(--navy)] underline">
              {policy.contactEmail}
            </a>
            .
          </div>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
