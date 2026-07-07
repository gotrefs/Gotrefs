import { BrandLogo } from "@/components/BrandLogo";
import { isPlatformAdmin } from "@/lib/admin-access";
import { resolveMemberRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { DashboardRoleSwitcher } from "./DashboardRoleSwitcher";
import { DashboardRoleProvider, type DashboardRole } from "./RoleContext";
import { DashboardNotificationCenter } from "./DashboardNotificationCenter";
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
  const memberRole = user ? await resolveMemberRole(supabase, user) : "ref";
  const initialRole: DashboardRole = memberRole === "organizer" ? "organizer" : "referee";
  const showAdminLink = user ? await isPlatformAdmin(supabase, user.id) : false;

  return (
    <DashboardRoleProvider initialRole={initialRole}>
      <div className="min-h-screen bg-[var(--bg)]">
        <header className="border-b border-[var(--border)] bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <BrandLogo href="/" imageClassName="h-9 w-auto" />
            <nav className="flex items-center gap-3 text-sm">
              {showAdminLink && (
                <Link href="/dashboard/admin/verifications" className="font-semibold text-[var(--blue)]">
                  Verifications
                </Link>
              )}
              {user && <DashboardRoleSwitcher />}
              {user && <DashboardNotificationCenter />}
              {user && <SignOutButton />}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </DashboardRoleProvider>
  );
}
