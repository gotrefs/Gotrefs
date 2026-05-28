import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { mapReportStatus, verifyCheckrWebhookSignature } from "@/lib/screening/checkr";

/**
 * Checkr webhook endpoint. Configure URL in Checkr dashboard.
 * https://docs.checkr.com/#tag/Webhooks
 *
 * Verifies X-Checkr-Content-HMAC when CHECKR_WEBHOOK_SECRET is set.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.CHECKR_WEBHOOK_SECRET?.trim();

  if (secret) {
    const sig = request.headers.get("x-checkr-content-hmac");
    if (!verifyCheckrWebhookSignature(raw, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = String(payload.type || "");
  const data = (payload.data as { object?: Record<string, unknown> } | undefined)?.object;

  const svc = createServiceClient();

  if (type === "report.completed" || type === "report.updated") {
    const candidateId = String(data?.candidate_id || "");
    const reportId = String(data?.id || "");
    const adjudication = String(data?.adjudication || data?.status || "");

    if (!candidateId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const status = mapReportStatus(adjudication);

    const { error } = await svc
      .from("screening_checks")
      .update({
        status,
        external_report_id: reportId || null,
        summary: `Checkr report ${type}: ${adjudication || "completed"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("external_candidate_id", candidateId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
