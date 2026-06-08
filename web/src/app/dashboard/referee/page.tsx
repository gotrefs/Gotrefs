import { redirect } from "next/navigation";
import { resolveMemberRole, dashboardPathForRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import RefereeDashboardClient from "./RefereeDashboardClient";

export default async function RefereeDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const role = await resolveMemberRole(supabase, user);
  if (role === "organizer") {
    redirect(dashboardPathForRole("organizer"));
  }

  return <RefereeDashboardClient />;
}
