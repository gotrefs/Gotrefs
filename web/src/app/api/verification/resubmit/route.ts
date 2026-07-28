import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: existing } = await admin
    .from("ref_verification_submissions")
    .select("fix_required_steps, status")
    .eq("ref_member_id", user.id)
    .maybeSingle();

  const status = existing?.status ?? "not_submitted";
  const fixSteps = normalizeFixRequiredSteps(existing?.fix_required_steps);
  const canResubmit =
    fixSteps.length > 0 ||
    status === "rejected" ||
    status === "under_review" ||
    status === "submitted";

  if (!canResubmit) {
    return NextResponse.json(
      { error: "Your account is not waiting on a resubmission right now." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ref_member_id: user.id,
    status: "submitted",
    resubmitted_at: now,
    reviewed_at: null,
    fix_required_steps: [],
    updated_at: now,
  };
  // Keep original submitted_at on a true resubmit; set it for first queue entry.
  if (existing?.status !== "submitted" && existing?.status !== "under_review") {
    patch.submitted_at = now;
  }

  const { error } = await admin.from("ref_verification_submissions").upsert(patch, {
    onConflict: "ref_member_id",
  });

  if (error) {
    // Retry without optional columns if migrations lag.
    if (error.message.includes("resubmitted_at") || error.message.includes("fix_required_steps")) {
      const { error: basicError } = await admin.from("ref_verification_submissions").upsert(
        {
          ref_member_id: user.id,
          status: "submitted",
          submitted_at: now,
          reviewed_at: null,
          updated_at: now,
        },
        { onConflict: "ref_member_id" }
      );
      if (basicError) {
        return NextResponse.json({ error: basicError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await admin.from("screening_checks").upsert(
    {
      ref_member_id: user.id,
      status: "pending",
      summary: "Verification resubmitted — pending admin review",
      updated_at: now,
    },
    { onConflict: "ref_member_id" }
  );

  return NextResponse.json({ ok: true, status: "submitted" });
}
