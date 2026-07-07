import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refProfilePackageComplete } from "@/lib/ref-eligibility";

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
    return NextResponse.json({ error: "Only referees can submit verification." }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("ref_profiles")
    .select(
      "government_id_path, certification_document_path, verification_doc_path, bio, primary_sport, certification_level"
    )
    .eq("member_id", user.id)
    .maybeSingle();

  if (!refProfilePackageComplete(profile)) {
    const missing: string[] = [];
    if (!profile?.government_id_path && !profile?.verification_doc_path) missing.push("government ID");
    if (!profile?.certification_document_path) missing.push("certification document");
    if (!profile?.bio?.trim() || !profile?.primary_sport || !profile?.certification_level?.trim()) {
      missing.push("profile (sport, certification level, bio)");
    }
    return NextResponse.json(
      { error: `Complete before submitting: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("ref_verification_submissions")
    .select("status, review_version")
    .eq("ref_member_id", user.id)
    .maybeSingle();

  if (existing?.status === "submitted" || existing?.status === "under_review") {
    return NextResponse.json(
      { error: "Your verification package is already awaiting review." },
      { status: 400 }
    );
  }

  const nextVersion =
    existing?.status === "rejected" ? (existing.review_version ?? 1) + 1 : existing?.review_version ?? 1;

  const now = new Date().toISOString();
  const { error } = await supabase.from("ref_verification_submissions").upsert(
    {
      ref_member_id: user.id,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
      rejection_reason: null,
      reviewed_at: null,
      reviewed_by: null,
      review_version: nextVersion,
      verification_provider: "manual",
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
      summary: "Pending manual review",
      updated_at: now,
    })
    .eq("ref_member_id", user.id);

  return NextResponse.json({ ok: true, status: "submitted" });
}
