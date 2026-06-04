import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white px-4 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BrandLogo href="/" imageClassName="h-10 w-auto" priority />
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/auth/login" className="font-medium text-[var(--blue)] hover:opacity-80">
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-md bg-[var(--red)] px-3 py-1.5 font-medium text-white hover:opacity-95"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
