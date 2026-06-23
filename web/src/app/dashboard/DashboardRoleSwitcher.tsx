"use client";

import { useDashboardRole, type DashboardRole } from "./RoleContext";

export function DashboardRoleSwitcher() {
  const { currentRole, switchRole } = useDashboardRole();
  const nextRole: DashboardRole = currentRole === "organizer" ? "referee" : "organizer";

  return (
    <>
      <div className="hidden rounded-full border border-[var(--border)] bg-[var(--grey-light)] p-1 sm:flex">
        <button
          type="button"
          onClick={() => switchRole("referee")}
          className={`rounded-full px-3 py-1.5 font-semibold transition-all duration-200 ${
            currentRole === "referee"
              ? "bg-white text-[var(--red)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--navy)]"
          }`}
        >
          Referee
        </button>
        <button
          type="button"
          onClick={() => switchRole("organizer")}
          className={`rounded-full px-3 py-1.5 font-semibold transition-all duration-200 ${
            currentRole === "organizer"
              ? "bg-white text-[var(--blue)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--navy)]"
          }`}
        >
          Organizer
        </button>
      </div>
      <button
        type="button"
        onClick={() => switchRole(nextRole)}
        className={`font-medium hover:opacity-80 sm:hidden ${
          currentRole === "referee" ? "text-[var(--blue)]" : "text-[var(--red)]"
        }`}
      >
        {nextRole === "organizer" ? "Switch to Organizer View" : "Switch to Referee View"}
      </button>
    </>
  );
}
