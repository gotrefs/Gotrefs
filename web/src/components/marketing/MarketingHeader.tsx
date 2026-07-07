import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoRequestButton } from "./DemoRequestButton";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1b2132]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        <BrandLogo href="/" src="/gotrefs-logo-blue-background.png" imageClassName="h-14 w-auto sm:h-20" priority />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/90 md:flex">
          <Link href="#features" className="hover:text-white">
            How it works
          </Link>
          <Link href="#ref-verification" className="hover:text-white">
            For Referees
          </Link>
          <Link href="#for-organizers" className="hover:text-white">
            For Organizers
          </Link>
          <Link href="/assignors" className="hover:text-white">
            For Assignors
          </Link>
          <Link href="/policies" className="hover:text-white">
            Policies
          </Link>
          <Link href="#faq" className="hover:text-white">
            FAQ
          </Link>
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
