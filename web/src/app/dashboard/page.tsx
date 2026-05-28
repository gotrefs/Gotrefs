import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (member?.role === "organizer") {
    redirect("/dashboard/organizer");
  }
  redirect("/dashboard/referee");
}
