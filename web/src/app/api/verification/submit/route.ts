import { NextResponse } from "next/server";
import { notifyInBackground, notifyProfileSubmitted } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refProfilePackageComplete, refVerificationDocsComplete } from "@/lib/ref-eligibility";

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

  const docsReady = refVerificationDocsComplete(profile);
  const fullPackage = refProfilePackageComplete(profile);

  if (!docsReady && !fullPackage) {
    const missing: string[] = [];
    if (!profile?.government_id_path && !profile?.verification_doc_path) missing.push("government ID");
    if (!profile?.certification_document_path) missing.push("certification document");
    if (!profile?.primary_sport?.trim()) missing.push("primary sport");
    if (!profile?.certification_level?.trim()) missing.push("certification level");
    if (!fullPackage && profile?.bio && !profile.bio.trim()) missing.push("bio");
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
      status: "pending",
      summary: "Verification package submitted — pending admin review (1-2 business days)",
      updated_at: new Date().toISOString(),
    })
    .eq("ref_member_id", user.id);

  try {
    const admin = createServiceClient();
    notifyInBackground(() =>
      notifyProfileSubmitted({
        admin,
        refMemberId: user.id,
        siteUrl: emailSiteUrl(),
      })
    );
  } catch {
    // Email is best-effort.
  }

  return NextResponse.json({ ok: true, status: "submitted" });
}
