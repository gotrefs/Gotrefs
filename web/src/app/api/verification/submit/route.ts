import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refOfferEligible, refProfilePackageComplete } from "@/lib/ref-eligibility";

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

  const { error } = await supabase.from("ref_verification_submissions").upsert(
    {
      ref_member_id: user.id,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ref_member_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("screening_checks")
    .update({
      status: "clear",
      summary: "Verification package submitted — eligible for offers pending admin review",
      updated_at: new Date().toISOString(),
    })
    .eq("ref_member_id", user.id);

  return NextResponse.json({ ok: true, status: "submitted" });
}
