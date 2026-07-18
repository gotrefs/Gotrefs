import type { DashboardRole } from "./RoleContext";

export function DashboardRoleLabel({ role }: { role: DashboardRole }) {
  return (
    <span className="hidden text-sm font-semibold text-[var(--navy)] sm:inline">
      {role === "organizer" ? "Organizer dashboard" : "Referee dashboard"}
    </span>
  );
}
