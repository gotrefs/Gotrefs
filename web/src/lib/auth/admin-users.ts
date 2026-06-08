import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Find auth user by email via admin API (paginated scan). */
export async function findUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[admin-users] listUsers:", error.message);
      return null;
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/** Mark email confirmed so password login works without inbox delivery. */
export async function confirmUserEmail(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (error) {
    console.error("[admin-users] confirm:", error.message);
    return false;
  }
  return true;
}
