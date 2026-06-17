import type { SupabaseClient, User } from "@supabase/supabase-js";
import { resolveMemberRole } from "@/lib/member-role";

/** Organizers must be signed-in members (not anonymous) to browse or contact refs. */
export async function isOrganizerMember(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "user_metadata">
): Promise<boolean> {
  const role = await resolveMemberRole(supabase, user);
  if (role !== "organizer") return false;

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  return member?.role === "organizer";
}
