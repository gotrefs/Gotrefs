import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeFixRequiredSteps } from "@/lib/ref-verification-steps";
import {
  refCanApplyToGames,
  refMissingApplyStep,
  refVerificationApproved,
} from "@/lib/ref-eligibility";

/**
 * Authoritative verification status for the logged-in ref (service role).
 * Avoids client RLS/select edge cases leaving the dashboard stuck on "draft".
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const [{ data: member }, { data: profile }, { data: submission }, { data: screening }] =
    await Promise.all([
      admin.from("members").select("role").eq("id", user.id).maybeSingle(),
      admin
        .from("ref_profiles")
        .select(
          "verification_method, external_verification_proof_path, government_id_path, verification_doc_path, certification_document_path, primary_sport, certification_level, bio"
        )
        .eq("member_id", user.id)
        .maybeSingle(),
      admin
        .from("ref_verification_submissions")
        .select("status, admin_notes, updated_at, reviewed_at, fix_required_steps, resubmitted_at")
        .eq("ref_member_id", user.id)
        .maybeSingle(),
      admin.from("screening_checks").select("status, summary").eq("ref_member_id", user.id).maybeSingle(),
    ]);

  if (member?.role !== "ref") {
    return NextResponse.json({ error: "Referee account required." }, { status: 403 });
  }

  let status = submission?.status || "draft";
  // If admin clearance exists but submission row lagged, treat as approved for booking.
  if (
    !refVerificationApproved(status) &&
    screening?.status === "clear" &&
    /admin approved/i.test(screening.summary || "")
  ) {
    status = "approved";
  }

  const eligibilityArgs = {
    screeningStatus: screening?.status,
    screeningSummary: screening?.summary,
    verificationMethod: profile?.verification_method,
    externalProofPath: profile?.external_verification_proof_path,
    verificationSubmissionStatus: status,
    profile,
  };

  return NextResponse.json({
    status,
    adminNotes: submission?.admin_notes?.trim() || null,
    updatedAt: submission?.updated_at || null,
    reviewedAt: submission?.reviewed_at || null,
    fixRequiredSteps: normalizeFixRequiredSteps(submission?.fix_required_steps),
    resubmittedAt: submission?.resubmitted_at || null,
    screeningStatus: screening?.status || null,
    screeningSummary: screening?.summary || null,
    canApplyToGames: refCanApplyToGames(eligibilityArgs),
    missingStep: refMissingApplyStep(eligibilityArgs),
  });
}
