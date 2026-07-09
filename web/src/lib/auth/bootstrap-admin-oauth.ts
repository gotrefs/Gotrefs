import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isGotrefsAdminEmail } from "@/lib/auth/admin-access";

/** Ensure admin OAuth accounts are onboarded without referee/organizer signup. */
export async function ensureAdminOAuthMember(admin: SupabaseClient, user: User) {
  if (!isGotrefsAdminEmail(user.email)) return false;

  const now = new Date().toISOString();
  const meta = user.user_metadata ?? {};
  const displayName =
    String(meta.full_name ?? "").trim() ||
    `${String(meta.first_name ?? "").trim()} ${String(meta.last_name ?? "").trim()}`.trim() ||
    user.email?.split("@")[0] ||
    "GotREFS Admin";

  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), gotrefs_admin: true },
  });

  await admin.from("members").upsert(
    {
      id: user.id,
      role: "ref",
      display_name: displayName,
      first_name: String(meta.first_name ?? "").trim() || null,
      last_name: String(meta.last_name ?? "").trim() || null,
      email: user.email?.trim().toLowerCase() || null,
      is_onboarded: true,
      last_login_at: now,
    },
    { onConflict: "id" }
  );

  return true;
}
