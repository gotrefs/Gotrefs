import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardIndexClient } from "./DashboardIndexClient";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  return <DashboardIndexClient />;
}
