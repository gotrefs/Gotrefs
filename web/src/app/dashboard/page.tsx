import { redirect } from "next/navigation";
import { gotrefsAdminDashboardPath, isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { dashboardPathForRole, resolveMemberRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  if (isGotrefsAdminUser(user)) {
    redirect(gotrefsAdminDashboardPath());
  }

  const role = await resolveMemberRole(supabase, user);
  redirect(dashboardPathForRole(role));
}
