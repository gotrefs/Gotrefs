import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

/** Ensure auth.users has a matching public.members row (fixes signups before migrations). */
export async function POST(request: NextRequest) {
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return jsonWithSessionCookies(sessionResponse, { ok: true, skipped: "no_service_role" });
  }

  const { data: existing } = await admin.from("members").select("id").eq("id", user.id).maybeSingle();
  if (existing) {
    return jsonWithSessionCookies(sessionResponse, { ok: true });
  }

  const meta = user.user_metadata ?? {};
  const role = meta.role === "organizer" ? "organizer" : "ref";
  const fn = String(meta.first_name ?? "").trim();
  const ln = String(meta.last_name ?? "").trim();
  const displayName =
    `${fn} ${ln}`.trim() ||
    String(meta.full_name ?? "").trim() ||
    user.email?.split("@")[0] ||
    "User";

  const { error: memberErr } = await admin.from("members").insert({
    id: user.id,
    role,
    display_name: displayName,
    first_name: fn || null,
    last_name: ln || null,
    organization_name: role === "organizer" ? meta.organization_name ?? null : null,
  });

  if (memberErr) {
    console.error("[sync-member]", memberErr.message);
    return jsonWithSessionCookies(sessionResponse, { ok: false, error: memberErr.message });
  }

  if (role === "ref") {
    await admin.from("ref_profiles").upsert({ member_id: user.id }, { onConflict: "member_id" });
    await admin.from("screening_checks").upsert({ ref_member_id: user.id }, { onConflict: "ref_member_id" });
  } else {
    await admin.from("organizer_profiles").upsert({ member_id: user.id }, { onConflict: "member_id" });
  }

  return jsonWithSessionCookies(sessionResponse, { ok: true, created: true });
}
