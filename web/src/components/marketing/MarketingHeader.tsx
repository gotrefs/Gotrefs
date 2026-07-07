import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoRequestButton } from "./DemoRequestButton";
import { MarketingHashScroll } from "./MarketingHashScroll";
import { MarketingNavLink } from "./MarketingNavLink";

const NAV_LINKS = [
  { href: "#features", label: "How it works" },
  { href: "#ref-verification", label: "For Referees" },
  { href: "#for-organizers", label: "For Organizers" },
  { href: "/assignors", label: "For Assignors" },
  { href: "/policies", label: "Policies" },
  { href: "#faq", label: "FAQ" },
] as const;

export function MarketingHeader() {
  return (
    <>
      <MarketingHashScroll />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1b2132]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        <BrandLogo href="/" src="/gotrefs-logo-blue-background.png" imageClassName="h-14 w-auto sm:h-20" priority />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/90 md:flex" aria-label="Main">
          {NAV_LINKS.map((item) => (
            <MarketingNavLink key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </MarketingNavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/auth/login" className="hidden text-sm font-semibold text-white/90 hover:text-white sm:inline">
            Log in
          </Link>
          <DemoRequestButton className="btn-demo-header" />
        </div>
      </div>
      <nav
        className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 pb-3 text-xs font-semibold text-white/90 md:hidden"
        aria-label="Main mobile"
      >
        {NAV_LINKS.map((item) => (
          <MarketingNavLink
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40 hover:text-white"
          >
            {item.label}
          </MarketingNavLink>
        ))}
        <Link
          href="/auth/login"
          className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40 hover:text-white"
        >
          Log in
        </Link>
      </nav>
    </header>
    </>
  );
}
