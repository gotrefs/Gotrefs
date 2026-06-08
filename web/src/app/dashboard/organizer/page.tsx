import { redirect } from "next/navigation";
import { resolveMemberRole, dashboardPathForRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import OrganizerDashboardClient from "./OrganizerDashboardClient";

export default async function OrganizerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const role = await resolveMemberRole(supabase, user);
  if (role === "ref") {
    redirect(dashboardPathForRole("ref"));
  }

  return <OrganizerDashboardClient />;
}
