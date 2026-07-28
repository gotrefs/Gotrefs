import Image from "next/image";
import Link from "next/link";
import siteData from "@/data/site-data.json";
import { BRAND_NAME } from "@/lib/brand";
import { NATIONAL_SPORTSID } from "@/lib/partners";
import { PolicyFooterLinks } from "./PolicyFooterLinks";

const footer = siteData.footer as {
  copyright: string;
  legalLine: string;
  tagline: string;
  columns: { heading: string; links: { label: string; href: string }[] }[];
};

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--blue)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <p className="text-lg font-bold">{BRAND_NAME}</p>
            <p className="mt-2 text-sm text-white/70">{footer.tagline}</p>
          </div>
          {footer.columns.map((col) => (
            <div key={col.heading}>
              <p className="text-sm font-bold uppercase tracking-wide text-white/90">{col.heading}</p>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-white/90">Policies</p>
            <div className="mt-3">
              <PolicyFooterLinks />
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-white/60">{footer.copyright}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/45 sm:hidden">{footer.legalLine}</p>
          </div>
          <a
            href={NATIONAL_SPORTSID.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 py-2 transition hover:bg-white/15"
          >
            <Image
              src={NATIONAL_SPORTSID.logoSrc}
              alt={NATIONAL_SPORTSID.name}
              width={120}
              height={36}
              className="h-8 w-auto object-contain"
            />
            <span className="text-left">
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                Verification partner
              </span>
              <span className="block text-xs font-semibold text-white">{NATIONAL_SPORTSID.name}</span>
            </span>
          </a>
          <p className="hidden text-xs font-bold uppercase tracking-wide text-white/45 sm:block sm:text-right">
            {footer.legalLine}
          </p>
        </div>
      </div>
    </footer>
  );
}
