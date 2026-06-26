import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dashboardPathForRole,
  roleFromMemberRow,
  type MemberRole,
} from "@/lib/member-role";

export type SyncMemberResult = {
  ok: boolean;
  role: MemberRole;
  created?: boolean;
  repaired?: boolean;
  error?: string;
  skipped?: string;
};

/** Ensure public.members exists and role matches signup metadata / organizer signals. */
export async function syncMemberAccount(
  admin: SupabaseClient,
  user: User
): Promise<SyncMemberResult> {
  const meta = user.user_metadata ?? {};
  const metaRole: MemberRole = meta.role === "organizer" ? "organizer" : "ref";
  const fn = String(meta.first_name ?? "").trim();
  const ln = String(meta.last_name ?? "").trim();
  const phone = String(meta.phone ?? "").trim();
  const email = user.email?.trim().toLowerCase() || null;
  const now = new Date().toISOString();
  const displayName =
    `${fn} ${ln}`.trim() ||
    String(meta.full_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "User";

  const { data: existing } = await admin
    .from("members")
    .select("id, role, organization_name")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("members")
      .update({
        email,
        phone: phone || null,
        last_login_at: now,
      })
      .eq("id", user.id);

    const resolved = roleFromMemberRow(existing, meta);
    const shouldBeOrganizer = resolved === "organizer" || metaRole === "organizer";
    if (existing.role === "ref" && shouldBeOrganizer) {
      const orgName =
        existing.organization_name?.trim() ||
        String(meta.organization_name ?? "").trim() ||
        null;
      const { error: updateErr } = await admin
        .from("members")
        .update({ role: "organizer", organization_name: orgName })
        .eq("id", user.id);
      if (updateErr) {
        console.error("[sync-member] role repair:", updateErr.message);
        return { ok: false, role: "ref", error: updateErr.message };
      }
      await admin
        .from("organizer_profiles")
        .upsert({ member_id: user.id }, { onConflict: "member_id" });
      return { ok: true, role: "organizer", repaired: true };
    }
    const finalRole = shouldBeOrganizer ? "organizer" : roleFromMemberRow(existing, meta);
    return { ok: true, role: finalRole };
  }

  const { error: memberErr } = await admin.from("members").insert({
    id: user.id,
    role: metaRole,
    display_name: displayName,
    first_name: fn || null,
    last_name: ln || null,
    email,
    phone: phone || null,
    is_onboarded: false,
    last_login_at: now,
    organization_name: metaRole === "organizer" ? meta.organization_name ?? null : null,
  });

  if (memberErr) {
    console.error("[sync-member]", memberErr.message);
    return { ok: false, role: metaRole, error: memberErr.message };
  }

  if (metaRole === "ref") {
    await admin.from("ref_profiles").upsert({ member_id: user.id }, { onConflict: "member_id" });
    await admin
      .from("screening_checks")
      .upsert({ ref_member_id: user.id }, { onConflict: "ref_member_id" });
  } else {
    await admin
      .from("organizer_profiles")
      .upsert({ member_id: user.id }, { onConflict: "member_id" });
  }

  return { ok: true, role: metaRole, created: true };
}

export function dashboardRedirectForUser(
  role: MemberRole,
  nextPath?: string | null
): string {
  if (nextPath && nextPath !== "/dashboard") return nextPath;
  return dashboardPathForRole(role);
}
