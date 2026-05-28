import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-display text-xl font-bold text-[var(--navy)]">
            Got<span className="text-[var(--orange)]">Refs</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user && (
              <>
                <Link href="/dashboard/referee" className="text-[var(--slate)] hover:text-[var(--navy)]">
                  Referee
                </Link>
                <Link href="/dashboard/organizer" className="text-[var(--slate)] hover:text-[var(--navy)]">
                  Organizer
                </Link>
                <SignOutButton />
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
