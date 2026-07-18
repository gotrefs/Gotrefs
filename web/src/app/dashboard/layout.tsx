import { BrandLogo } from "@/components/BrandLogo";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { resolveMemberRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboardLink } from "./AdminDashboardLink";
import { DashboardRoleLabel } from "./DashboardRoleLabel";
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
  const isAdmin = isGotrefsAdminUser(user);
  const memberRole = user ? await resolveMemberRole(supabase, user) : "ref";
  const initialRole: DashboardRole = memberRole === "organizer" ? "organizer" : "referee";

  return (
    <DashboardRoleProvider initialRole={initialRole}>
      <div className="min-h-screen bg-[var(--bg)]">
        <header className="border-b border-[var(--border)] bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <BrandLogo href="/" imageClassName="h-12 w-auto" />
            <nav className="flex items-center gap-3 text-sm">
              {user && !isAdmin && <DashboardRoleLabel role={initialRole} />}
              {user && isAdmin && <AdminDashboardLink />}
              {user && !isAdmin && <DashboardNotificationCenter />}
              {user && <SignOutButton />}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </DashboardRoleProvider>
  );
}
