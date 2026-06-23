"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPathForActiveRole, useDashboardRole } from "./RoleContext";

export function DashboardIndexClient() {
  const router = useRouter();
  const { currentRole } = useDashboardRole();

  useEffect(() => {
    router.replace(dashboardPathForActiveRole(currentRole));
  }, [currentRole, router]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)] shadow-sm">
      Opening your {currentRole === "organizer" ? "organizer" : "referee"} dashboard...
    </div>
  );
}
