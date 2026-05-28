import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RefereeDashboardClient from "./RefereeDashboardClient";

export default async function RefereeDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase.from("members").select("role").eq("id", user.id).single();
  if (member?.role !== "ref") {
    redirect("/dashboard/organizer");
  }

  return <RefereeDashboardClient />;
}
