import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { resolveMemberRole, dashboardPathForRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";

const AdminVerificationClient = dynamic(() => import("./AdminVerificationClient"), {
  loading: () => (
    <p className="text-sm text-[var(--muted)]">Loading verification review tools…</p>
  ),
});

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/dashboard/admin");
  }

  if (!isGotrefsAdminUser(user)) {
    const role = await resolveMemberRole(supabase, user);
    redirect(dashboardPathForRole(role));
  }

  return <AdminVerificationClient />;
}
