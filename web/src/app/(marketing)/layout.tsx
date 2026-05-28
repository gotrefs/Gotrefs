import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--navy)] px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold tracking-tight text-white">
            Got<span className="text-[var(--orange)]">Refs</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/auth/login" className="text-white/75 hover:text-white">
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-md bg-[var(--orange)] px-3 py-1.5 font-medium text-white hover:opacity-95"
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
