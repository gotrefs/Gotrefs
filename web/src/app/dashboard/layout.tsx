import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { resolveMemberRole } from "@/lib/member-role";
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

  let role: "ref" | "organizer" | null = null;
  if (user) {
    role = await resolveMemberRole(supabase, user);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <BrandLogo href="/" imageClassName="h-9 w-auto" />
          <nav className="flex items-center gap-4 text-sm">
            {user && role === "ref" && (
              <Link href="/dashboard/referee" className="font-medium text-[var(--red)] hover:opacity-80">
                Referee dashboard
              </Link>
            )}
            {user && role === "organizer" && (
              <Link href="/dashboard/organizer" className="font-medium text-[var(--blue)] hover:opacity-80">
                Organizer dashboard
              </Link>
            )}
            {user && <SignOutButton />}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
