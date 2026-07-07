import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase.from("members").select("role").eq("id", user.id).single();
  if (member?.role !== "ref") {
    return NextResponse.json({ error: "Only referees can read verification status." }, { status: 403 });
  }

  const { data: submission } = await supabase
    .from("ref_verification_submissions")
    .select("status, submitted_at, reviewed_at, rejection_reason, review_version")
    .eq("ref_member_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    status: submission?.status ?? "draft",
    submittedAt: submission?.submitted_at ?? null,
    reviewedAt: submission?.reviewed_at ?? null,
    rejectionReason: submission?.rejection_reason ?? null,
    reviewVersion: submission?.review_version ?? 1,
  });
}
