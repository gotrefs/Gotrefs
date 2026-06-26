import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssignorDashboardClient from "./AssignorDashboardClient";

export default async function AssignorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard/assignor");

  return <AssignorDashboardClient />;
}
