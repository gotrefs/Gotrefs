import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrganizerDashboardClient from "./OrganizerDashboardClient";

export default async function OrganizerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return <OrganizerDashboardClient />;
}
