import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { activateQueuedSignupRequests } from "@/lib/activate-queued-signups";
import { notifyVerificationDecision } from "@/lib/email/notifications";
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

  if (action === "reject" && !adminNotesInput) {
    return NextResponse.json(
      { error: "Add a reason explaining why this referee is not approved." },
      { status: 400 }
    );
  }

  if (action === "request_info" && !adminNotesInput) {
    return NextResponse.json({ error: "Add a message explaining what the referee needs to change." }, { status: 400 });
  }

  // Reject can be used to revoke a prior approval. Fix steps are optional so admins
  // can revoke with a reason only; when steps are selected the ref gets a resubmit path.
  if (action === "request_info" && fixRequiredSteps.length === 0) {
    return NextResponse.json(
      { error: "Select at least one item (1–5) the referee needs to fix before sending." },
      { status: 400 }
    );
  }

  const status =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "under_review";

  const adminNotes =
    adminNotesInput ||
    (action === "approve"
      ? "Application Approved — you can now request to work games on GotRefs!"
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

    // Needs info / reject always clears approval so the ref is pending again until re-approved.
    const submissionPatch: Record<string, unknown> = {
      ref_member_id: refMemberId,
      status,
      submitted_at: existing?.submitted_at ?? now,
      reviewed_at: now,
      admin_notes: adminNotes,
      fix_required_steps: action === "approve" ? [] : fixRequiredSteps,
      updated_at: now,
      // Any non-approve decision ends the prior approval cycle.
      resubmitted_at: null,
    };

    const { error: submissionError } = await admin
      .from("ref_verification_submissions")
      .upsert(submissionPatch, { onConflict: "ref_member_id" });

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
      await admin.from("screening_checks").upsert(
        {
          ref_member_id: refMemberId,
          status: "consider",
          summary: adminNotes || "Verification rejected — approval revoked",
          updated_at: now,
        },
        { onConflict: "ref_member_id" }
      );
    } else {
      // Needs info: revoke prior clearance so they cannot apply until they fix + you re-approve.
      await admin.from("screening_checks").upsert(
        {
          ref_member_id: refMemberId,
          status: "pending",
          summary: "Changes requested — approval paused until ref resubmits and is re-approved",
          updated_at: now,
        },
        { onConflict: "ref_member_id" }
      );
    }

    const siteUrl = emailSiteUrl(request.url);
    let queuedActivated = 0;

    if (action === "approve") {
      const flushed = await activateQueuedSignupRequests({
        admin,
        refMemberId,
        siteUrl,
      });
      queuedActivated = flushed.activated;
    }

    let emailSent = false;
    try {
      // Await so serverless runtimes don't drop the Resend call.
      emailSent = await notifyVerificationDecision({
        admin,
        refMemberId,
        approved: action === "approve",
        // Needs info always; Reject with fix steps also emails “please make these changes.”
        changesRequested: action === "request_info" || (action === "reject" && fixRequiredSteps.length > 0),
        adminNotes,
        fixRequiredSteps: action === "approve" ? [] : fixRequiredSteps,
        siteUrl,
      });
    } catch (error) {
      console.error("[admin/verification] email notification failed:", error);
    }

    return NextResponse.json({
      ok: true,
      status,
      adminNotes,
      fixRequiredSteps: action === "approve" ? [] : fixRequiredSteps,
      queuedActivated,
      emailSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update verification.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
