import type { User } from "@supabase/supabase-js";

function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase().replace(/^["']|["']$/g, "");
}

function adminEmailAllowlist(): string[] {
  const raw = process.env.GOTREFS_ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => normalizeAdminEmail(email))
    .filter(Boolean);
}

export function isGotrefsAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailAllowlist().includes(normalizeAdminEmail(email));
}

type AdminUserLike = Pick<User, "email" | "app_metadata"> | null | undefined;

export function isGotrefsAdminUser(user: AdminUserLike): boolean {
  if (!user) return false;
  if (user.app_metadata?.gotrefs_admin === true) return true;
  return isGotrefsAdminEmail(user.email ?? null);
}

export function gotrefsAdminDashboardPath(): string {
  return "/dashboard/admin";
}
