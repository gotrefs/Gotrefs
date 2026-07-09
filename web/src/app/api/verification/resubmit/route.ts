import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeFixRequiredSteps } from "@/lib/ref-verification-steps";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase.from("members").select("role").eq("id", user.id).single();
  if (member?.role !== "ref") {
    return NextResponse.json({ error: "Only referees can resubmit verification." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("ref_verification_submissions")
    .select("fix_required_steps, status")
    .eq("ref_member_id", user.id)
    .maybeSingle();

  const fixSteps = normalizeFixRequiredSteps(existing?.fix_required_steps);
  if (fixSteps.length === 0) {
    return NextResponse.json({ error: "No fix steps are required for your account." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("ref_verification_submissions").upsert(
    {
      ref_member_id: user.id,
      status: "submitted",
      submitted_at: now,
      resubmitted_at: now,
      reviewed_at: null,
      fix_required_steps: [],
      updated_at: now,
    },
    { onConflict: "ref_member_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("screening_checks")
    .update({
      status: "pending",
      summary: "Verification resubmitted — pending admin review",
      updated_at: now,
    })
    .eq("ref_member_id", user.id);

  return NextResponse.json({ ok: true, status: "submitted" });
}
