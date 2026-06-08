import { redirect } from "next/navigation";
import { resolveMemberRole, dashboardPathForRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const role = await resolveMemberRole(supabase, user);
  redirect(dashboardPathForRole(role));
}
