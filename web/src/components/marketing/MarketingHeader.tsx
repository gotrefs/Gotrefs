import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoRequestButton } from "./DemoRequestButton";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1b2132]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <BrandLogo href="/" src="/gotrefs-shield-logo.png" imageClassName="h-14 w-auto" priority />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/90 md:flex">
          <Link href="#features" className="hover:text-white">
            How it works
          </Link>
          <Link href="#for-referees" className="hover:text-white">
            For Referees
          </Link>
          <Link href="#for-organizers" className="hover:text-white">
            For Organizers
          </Link>
          <Link href="#faq" className="hover:text-white">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/auth/login" className="hidden text-sm font-semibold text-white/90 hover:text-white sm:inline">
            Log in
          </Link>
          <DemoRequestButton className="btn-demo-header" />
        </div>
      </div>
    </header>
  );
}
