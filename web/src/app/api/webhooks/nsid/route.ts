import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

type NsidWebhookBody = {
  refMemberId?: string;
  externalVerificationId?: string;
  action?: "approve" | "reject";
  reason?: string;
};

/**
 * Stub for future NSID integration. Validates a shared secret and mirrors admin approve/deny.
 * Wire NSID's webhook to this endpoint when their API is available.
 */
export async function POST(request: Request) {
  const secret = process.env.NSID_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "NSID webhook is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("x-nsid-signature") ?? request.headers.get("authorization");
  if (provided !== secret && provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: NsidWebhookBody;
  try {
    body = (await request.json()) as NsidWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const refId = body.refMemberId?.trim();
  if (!refId || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json(
      { error: "refMemberId and action (approve|reject) are required." },
      { status: 400 }
    );
  }

  if (body.action === "reject" && !body.reason?.trim()) {
    return NextResponse.json({ error: "reason is required when rejecting." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const now = new Date().toISOString();

  if (body.action === "approve") {
    await admin.from("ref_verification_submissions").upsert(
      {
        ref_member_id: refId,
        status: "approved",
        reviewed_at: now,
        rejection_reason: null,
        verification_provider: "nsid",
        external_verification_id: body.externalVerificationId?.trim() || null,
        updated_at: now,
      },
      { onConflict: "ref_member_id" }
    );

    await admin.from("screening_checks").upsert(
      {
        ref_member_id: refId,
        status: "clear",
        provider: "nsid",
        summary: "Approved via NSID",
        updated_at: now,
      },
      { onConflict: "ref_member_id" }
    );

    return NextResponse.json({ ok: true, status: "approved" });
  }

  await admin.from("ref_verification_submissions").upsert(
    {
      ref_member_id: refId,
      status: "rejected",
      reviewed_at: now,
      rejection_reason: body.reason?.trim() ?? "Rejected by NSID",
      verification_provider: "nsid",
      external_verification_id: body.externalVerificationId?.trim() || null,
      updated_at: now,
    },
    { onConflict: "ref_member_id" }
  );

  await admin.from("screening_checks").upsert(
    {
      ref_member_id: refId,
      status: "consider",
      provider: "nsid",
      summary: body.reason?.trim() ?? "Rejected by NSID",
      updated_at: now,
    },
    { onConflict: "ref_member_id" }
  );

  return NextResponse.json({ ok: true, status: "rejected" });
}
