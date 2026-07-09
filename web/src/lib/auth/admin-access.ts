import type { User } from "@supabase/supabase-js";

function adminEmailAllowlist(): string[] {
  const raw = process.env.GOTREFS_ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isGotrefsAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return adminEmailAllowlist().includes(normalized);
}

export function isGotrefsAdminUser(user: Pick<User, "email"> | null | undefined): boolean {
  return isGotrefsAdminEmail(user?.email ?? null);
}

export function gotrefsAdminDashboardPath(): string {
  return "/dashboard/admin";
}
