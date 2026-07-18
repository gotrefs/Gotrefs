import type { SupabaseClient, User } from "@supabase/supabase-js";

export type MemberRole = "ref" | "organizer";

type MemberRow = {
  role: string | null;
} | null;

export function dashboardPathForRole(role: MemberRole): string {
  return role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee";
}

/** Post-email-verification destination based on signup wizard role. */
export function dashboardPathForSignupRole(
  role: MemberRole,
  isAssignor: boolean
): string {
  if (isAssignor) return "/dashboard/assignor";
  return dashboardPathForRole(role);
}

/** Resolve role from members row, then auth metadata fallback. */
export function roleFromMemberRow(
  member: MemberRow,
  metadata?: Record<string, unknown> | null
): MemberRole {
  if (member?.role === "organizer") return "organizer";
  if (member?.role === "ref") return "ref";
  if (metadata?.role === "organizer") return "organizer";
  return "ref";
}

/** Load the role chosen at signup (one dashboard per email). */
export async function resolveMemberRole(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "user_metadata">
): Promise<MemberRole> {
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return roleFromMemberRow(member, user.user_metadata);
}
