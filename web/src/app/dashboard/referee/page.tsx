import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RefereeDashboardClient from "./RefereeDashboardClient";

export default async function RefereeDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase.from("members").select("role").eq("id", user.id).maybeSingle();
  // Only redirect when role is explicitly organizer — missing row must not bounce to organizer.
  if (member?.role === "organizer") {
    redirect("/dashboard/organizer");
  }

  return <RefereeDashboardClient />;
}
