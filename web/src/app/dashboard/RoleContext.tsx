"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type DashboardRole = "organizer" | "referee";

type RoleContextValue = {
  currentRole: DashboardRole;
  switchRole: (role: DashboardRole) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

function roleFromPath(pathname: string | null): DashboardRole | null {
  if (pathname?.startsWith("/dashboard/organizer")) return "organizer";
  if (pathname?.startsWith("/dashboard/referee")) return "referee";
  return null;
}

function rolePath(role: DashboardRole) {
  return role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
}

export function DashboardRoleProvider({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole: DashboardRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState<DashboardRole>(() => roleFromPath(pathname) ?? initialRole);

  useEffect(() => {
    const routeRole = roleFromPath(pathname);
    if (routeRole && routeRole !== currentRole) {
      queueMicrotask(() => {
        setCurrentRole(routeRole);
        window.localStorage.setItem("gotrefs-dashboard-role", routeRole);
      });
    }
  }, [currentRole, pathname]);

  useEffect(() => {
    if (roleFromPath(pathname)) return;
    const stored = window.localStorage.getItem("gotrefs-dashboard-role");
    if (stored === "organizer" || stored === "referee") {
      queueMicrotask(() => setCurrentRole(stored));
    }
  }, [pathname]);

  const value = useMemo<RoleContextValue>(
    () => ({
      currentRole,
      switchRole: (role) => {
        setCurrentRole(role);
        window.localStorage.setItem("gotrefs-dashboard-role", role);
        router.push(rolePath(role));
      },
    }),
    [currentRole, router]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useDashboardRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useDashboardRole must be used inside DashboardRoleProvider");
  return value;
}

export function dashboardPathForActiveRole(role: DashboardRole) {
  return rolePath(role);
}
