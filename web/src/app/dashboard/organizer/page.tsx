import { redirect } from "next/navigation";
import { dashboardPathForRole, resolveMemberRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import OrganizerDashboardClient from "./OrganizerDashboardClient";

export default async function OrganizerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const setup = typeof params.setup === "string" ? params.setup : undefined;
  const nextPath =
    setup === "1" ? "/dashboard/organizer?setup=1" : "/dashboard/organizer";

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  const role = await resolveMemberRole(supabase, user);
  if (role !== "organizer") {
    redirect(dashboardPathForRole(role));
  }

  return <OrganizerDashboardClient />;
}
