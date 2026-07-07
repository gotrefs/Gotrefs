import type { SupabaseClient } from "@supabase/supabase-js";

function adminIdsFromEnv(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_USER_IDS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

/** True when the user may access platform admin APIs and pages. */
export async function isPlatformAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  if (adminIdsFromEnv().has(userId)) return true;

  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[admin-access] platform_admins lookup failed:", error.message);
    return false;
  }

  return Boolean(data?.user_id);
}

export async function requirePlatformAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const allowed = await isPlatformAdmin(supabase, userId);
  if (!allowed) {
    return { ok: false, status: 403, error: "Platform admin access required." };
  }
  return { ok: true };
}
