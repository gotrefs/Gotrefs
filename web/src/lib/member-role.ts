import type { SupabaseClient, User } from "@supabase/supabase-js";

export type MemberRole = "ref" | "organizer";

type MemberRow = {
  role: string | null;
  organization_name: string | null;
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

/** Resolve role from a members row plus auth metadata. */
export function roleFromMemberRow(
  member: MemberRow,
  metadata?: Record<string, unknown> | null
): MemberRole {
  if (member?.role === "organizer") return "organizer";
  if (member?.role === "ref") {
    if (member.organization_name?.trim()) return "organizer";
    return "ref";
  }
  if (metadata?.role === "organizer") return "organizer";
  return "ref";
}

/** Load role from DB (members + organizer profile + past events) with metadata fallback. */
export async function resolveMemberRole(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "user_metadata">
): Promise<MemberRole> {
  const { data: member } = await supabase
    .from("members")
    .select("role, organization_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = roleFromMemberRow(member, user.user_metadata);

  if (role === "ref") {
    const { data: orgProfile } = await supabase
      .from("organizer_profiles")
      .select("member_id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (orgProfile) return "organizer";

    const { count } = await supabase
      .from("scheduled_events")
      .select("id", { count: "exact", head: true })
      .eq("organizer_member_id", user.id);
    if (count && count > 0) return "organizer";
  }

  return role;
}
