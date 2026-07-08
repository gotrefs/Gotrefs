import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoRequestButton } from "./DemoRequestButton";
import { MarketingNavLink } from "./MarketingNavLink";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1b2132]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        <BrandLogo href="/" src="/gotrefs-logo-blue-background.png" imageClassName="h-10 w-auto sm:h-14" priority />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/90 md:flex">
          <MarketingNavLink href="#features" className="hover:text-white">
            How it works
          </MarketingNavLink>
          <MarketingNavLink href="#ref-verification" className="hover:text-white">
            For Referees
          </MarketingNavLink>
          <MarketingNavLink href="#for-organizers" className="hover:text-white">
            For Organizers
          </MarketingNavLink>
          <Link href="/assignors" className="hover:text-white">
            For Assignors
          </Link>
          <Link href="/policies" className="hover:text-white">
            Policies
          </Link>
          <MarketingNavLink href="#faq" className="hover:text-white">
            FAQ
          </MarketingNavLink>
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link href="/auth/login" className="hidden text-sm font-semibold text-white/90 hover:text-white sm:inline">
            Log in
          </Link>
          <DemoRequestButton className="btn-demo-header" />
        </div>
      </div>
    </header>
  );
}
