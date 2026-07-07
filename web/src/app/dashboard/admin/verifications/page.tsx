import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import AdminVerificationsClient from "./AdminVerificationsClient";

export default async function AdminVerificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const admin = await isPlatformAdmin(supabase, user.id);
  if (!admin) redirect("/dashboard");

  return <AdminVerificationsClient />;
}
