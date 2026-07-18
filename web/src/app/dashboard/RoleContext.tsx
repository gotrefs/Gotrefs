"use client";

import { createContext, useContext, useMemo } from "react";

export type DashboardRole = "organizer" | "referee";

type RoleContextValue = {
  currentRole: DashboardRole;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function DashboardRoleProvider({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole: DashboardRole;
}) {
  const value = useMemo<RoleContextValue>(() => ({ currentRole: initialRole }), [initialRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useDashboardRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useDashboardRole must be used inside DashboardRoleProvider");
  return value;
}

export function dashboardPathForActiveRole(role: DashboardRole) {
  return role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
}
