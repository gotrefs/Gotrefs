import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dashboardPathForRole, resolveMemberRole } from "@/lib/member-role";
import { createClient } from "@/lib/supabase/server";
import RefereeDashboardClient from "./RefereeDashboardClient";

export default async function RefereeDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const role = await resolveMemberRole(supabase, user);
  if (role !== "ref") {
    redirect(dashboardPathForRole(role));
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-neutral-800">Loading your referee dashboard…</p>
        </div>
      }
    >
      <RefereeDashboardClient />
    </Suspense>
  );
}
