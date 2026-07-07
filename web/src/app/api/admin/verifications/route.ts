import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = await requirePlatformAdmin(supabase, user.id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: submissions, error } = await admin
    .from("ref_verification_submissions")
    .select("ref_member_id, status, submitted_at, review_version")
    .in("status", ["submitted", "under_review"])
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const refIds = (submissions ?? []).map((row) => row.ref_member_id);
  if (refIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const [{ data: members }, { data: profiles }] = await Promise.all([
    admin.from("members").select("id, display_name").in("id", refIds),
    admin
      .from("ref_profiles")
      .select("member_id, primary_sport, certification_level")
      .in("member_id", refIds),
  ]);

  const emailById = new Map<string, string>();
  await Promise.all(
    refIds.map(async (id) => {
      const { data: authUser } = await admin.auth.admin.getUserById(id);
      if (authUser?.user?.email) emailById.set(id, authUser.user.email);
    })
  );

  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const profileById = new Map((profiles ?? []).map((p) => [p.member_id, p]));

  const items = (submissions ?? []).map((submission) => {
    const member = memberById.get(submission.ref_member_id);
    const profile = profileById.get(submission.ref_member_id);
    const email = emailById.get(submission.ref_member_id) ?? "";
    const maskedEmail = email.includes("@")
      ? `${email[0]}***@${email.split("@")[1] ?? "hidden"}`
      : null;

    return {
      refMemberId: submission.ref_member_id,
      status: submission.status,
      submittedAt: submission.submitted_at,
      reviewVersion: submission.review_version,
      displayName: member?.display_name ?? "Referee",
      emailMasked: maskedEmail,
      primarySport: profile?.primary_sport ?? null,
      certificationLevel: profile?.certification_level ?? null,
    };
  });

  return NextResponse.json({ items });
}
