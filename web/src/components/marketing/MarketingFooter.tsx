import Link from "next/link";
import siteData from "@/data/site-data.json";

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
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <p className="text-lg font-bold">GoTRefs</p>
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
        </div>
        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-white/15 pt-6 text-sm text-white/60 sm:flex-row">
          <p>{footer.copyright}</p>
          <p>{footer.legalLine}</p>
        </div>
      </div>
    </footer>
  );
}
