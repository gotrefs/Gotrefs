import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";
import { createVerificationDocumentSignedUrl } from "@/lib/verification-documents";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ReviewBody = {
  action?: "approve" | "reject";
  reason?: string;
  adminNotes?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ refId: string }> }
) {
  const { refId } = await context.params;
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

  const [{ data: member }, { data: profile }, { data: submission }, { data: screening }, authResult] =
    await Promise.all([
      admin.from("members").select("id, display_name, role").eq("id", refId).maybeSingle(),
      admin
        .from("ref_profiles")
        .select(
          "member_id, primary_sport, additional_sports, certification_level, bio, government_id_path, verification_doc_path, certification_document_path, verification_method, external_verifier_name, external_verification_proof_path"
        )
        .eq("member_id", refId)
        .maybeSingle(),
      admin
        .from("ref_verification_submissions")
        .select(
          "ref_member_id, status, submitted_at, reviewed_at, rejection_reason, admin_notes, review_version, verification_provider, external_verification_id"
        )
        .eq("ref_member_id", refId)
        .maybeSingle(),
      admin.from("screening_checks").select("status, summary, provider").eq("ref_member_id", refId).maybeSingle(),
      admin.auth.admin.getUserById(refId),
    ]);

  if (!member || member.role !== "ref") {
    return NextResponse.json({ error: "Referee not found." }, { status: 404 });
  }

  const govIdPath = profile?.government_id_path || profile?.verification_doc_path || null;
  const certPath = profile?.certification_document_path || null;
  const externalPath = profile?.external_verification_proof_path || null;

  const [governmentIdUrl, certificationUrl, externalProofUrl] = await Promise.all([
    createVerificationDocumentSignedUrl(govIdPath),
    createVerificationDocumentSignedUrl(certPath),
    createVerificationDocumentSignedUrl(externalPath),
  ]);

  return NextResponse.json({
    refMemberId: refId,
    displayName: member.display_name,
    email: authResult.data.user?.email ?? null,
    profile: {
      primarySport: profile?.primary_sport ?? null,
      additionalSports: profile?.additional_sports ?? [],
      certificationLevel: profile?.certification_level ?? null,
      bio: profile?.bio ?? null,
      verificationMethod: profile?.verification_method ?? null,
      externalVerifierName: profile?.external_verifier_name ?? null,
    },
    submission: submission ?? { status: "draft" },
    screening: screening ?? null,
    documents: {
      governmentIdPath: govIdPath,
      certificationPath: certPath,
      externalProofPath: externalPath,
      governmentIdUrl,
      certificationUrl,
      externalProofUrl,
    },
    nsidReviewUrl: process.env.NSID_REVIEW_URL?.trim() || null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ refId: string }> }
) {
  const { refId } = await context.params;
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

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 });
  }

  const reason = body.reason?.trim() ?? "";
  if (body.action === "reject" && !reason) {
    return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: submission } = await admin
    .from("ref_verification_submissions")
    .select("status")
    .eq("ref_member_id", refId)
    .maybeSingle();

  if (!submission || !["submitted", "under_review"].includes(submission.status)) {
    return NextResponse.json(
      { error: "This referee has no verification package awaiting review." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  if (body.action === "approve") {
    const { error: submissionError } = await admin
      .from("ref_verification_submissions")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: user.id,
        rejection_reason: null,
        admin_notes: body.adminNotes?.trim() || null,
        verification_provider: "manual",
        updated_at: now,
      })
      .eq("ref_member_id", refId);

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    await admin.from("screening_checks").upsert(
      {
        ref_member_id: refId,
        status: "clear",
        provider: "manual",
        summary: "Approved by GotREFS admin",
        updated_at: now,
      },
      { onConflict: "ref_member_id" }
    );

    return NextResponse.json({ ok: true, status: "approved" });
  }

  const { error: rejectError } = await admin
    .from("ref_verification_submissions")
    .update({
      status: "rejected",
      reviewed_at: now,
      reviewed_by: user.id,
      rejection_reason: reason,
      admin_notes: body.adminNotes?.trim() || null,
      updated_at: now,
    })
    .eq("ref_member_id", refId);

  if (rejectError) {
    return NextResponse.json({ error: rejectError.message }, { status: 500 });
  }

  await admin
    .from("screening_checks")
    .update({
      status: "consider",
      summary: `Verification denied: ${reason}`,
      updated_at: now,
    })
    .eq("ref_member_id", refId);

  return NextResponse.json({ ok: true, status: "rejected" });
}
