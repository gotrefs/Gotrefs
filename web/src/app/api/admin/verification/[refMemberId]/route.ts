import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { notifyInBackground, notifyVerificationDecision } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { normalizeFixRequiredSteps } from "@/lib/ref-verification-steps";
import { createServiceClient } from "@/lib/supabase/service";

type ReviewAction = "approve" | "reject" | "request_info";

type ReviewBody = {
  action?: ReviewAction;
  adminNotes?: string;
  fixRequiredSteps?: string[];
};

export async function PATCH(request: Request, context: { params: Promise<{ refMemberId: string }> }) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  const { refMemberId } = await context.params;
  if (!refMemberId) {
    return NextResponse.json({ error: "refMemberId is required." }, { status: 400 });
  }

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject" && action !== "request_info") {
    return NextResponse.json({ error: "action must be approve, reject, or request_info." }, { status: 400 });
  }

  const fixRequiredSteps = normalizeFixRequiredSteps(body.fixRequiredSteps);
  const adminNotesInput = (body.adminNotes ?? "").trim();
  const now = new Date().toISOString();

  if ((action === "reject" || action === "request_info") && fixRequiredSteps.length === 0) {
    return NextResponse.json(
      { error: "Select at least one item (1–5) the referee needs to fix before sending." },
      { status: 400 }
    );
  }

  if ((action === "reject" || action === "request_info") && !adminNotesInput) {
    return NextResponse.json({ error: "Add a message explaining what the referee needs to change." }, { status: 400 });
  }

  const status =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "under_review";

  const adminNotes =
    adminNotesInput ||
    (action === "approve"
      ? "Application Approved — you can now request to work games on GotREFS!"
      : action === "reject"
        ? "Your verification was not approved. Please complete the requested fixes and resubmit."
        : null);

  try {
    const admin = createServiceClient();

    const { data: member } = await admin.from("members").select("id, role").eq("id", refMemberId).maybeSingle();
    if (!member || member.role !== "ref") {
      return NextResponse.json({ error: "Referee not found." }, { status: 404 });
    }

    const { data: existing } = await admin
      .from("ref_verification_submissions")
      .select("submitted_at")
      .eq("ref_member_id", refMemberId)
      .maybeSingle();

    const { error: submissionError } = await admin.from("ref_verification_submissions").upsert(
      {
        ref_member_id: refMemberId,
        status,
        submitted_at: existing?.submitted_at ?? now,
        reviewed_at: action === "request_info" || action === "reject" ? now : now,
        resubmitted_at: action === "approve" ? null : existing ? undefined : null,
        admin_notes: adminNotes,
        fix_required_steps: action === "approve" ? [] : fixRequiredSteps,
        updated_at: now,
      },
      { onConflict: "ref_member_id" }
    );

    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    if (action === "approve") {
      await admin.from("screening_checks").upsert(
        {
          ref_member_id: refMemberId,
          status: "clear",
          summary: "Admin approved verification",
          updated_at: now,
        },
        { onConflict: "ref_member_id" }
      );
    } else if (action === "reject") {
      await admin
        .from("screening_checks")
        .update({
          status: "consider",
          summary: "Verification rejected — fixes requested",
          updated_at: now,
        })
        .eq("ref_member_id", refMemberId);
    } else {
      await admin
        .from("screening_checks")
        .update({
          status: "pending",
          summary: "Additional verification info requested",
          updated_at: now,
        })
        .eq("ref_member_id", refMemberId);
    }

    if (action === "approve" || action === "reject") {
      notifyInBackground(() =>
        notifyVerificationDecision({
          admin,
          refMemberId,
          approved: action === "approve",
          adminNotes,
          siteUrl: emailSiteUrl(request.url),
        })
      );
    }

    return NextResponse.json({
      ok: true,
      status,
      adminNotes,
      fixRequiredSteps: action === "approve" ? [] : fixRequiredSteps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update verification.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
