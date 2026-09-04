import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { disbursePaymentToRefs } from "@/lib/stripe/payouts";

/**
 * After an event ends, transfer held organizer payments to refs via Connect.
 * Cron: Authorization Bearer CRON_SECRET (or x-vercel-cron).
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const isCron =
    isVercelCron ||
    (Boolean(cronSecret) &&
      (authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret));

  if (!isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data: payments, error } = await admin
    .from("payments")
    .select("id, event_id, status, purpose, metadata, accepted_offer_ids")
    .eq("status", "paid")
    .eq("purpose", "event_refs")
    .not("event_id", "is", null)
    .order("paid_at", { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const payment of payments ?? []) {
    const meta = (payment.metadata || {}) as Record<string, unknown>;
    if (meta.payoutHold === "immediate") {
      skipped += 1;
      continue;
    }
    if (meta.payoutDisbursedAt) {
      skipped += 1;
      continue;
    }

    const { data: event } = await admin
      .from("scheduled_events")
      .select("ends_at")
      .eq("id", payment.event_id)
      .maybeSingle();

    if (!event?.ends_at || event.ends_at > nowIso) {
      skipped += 1;
      continue;
    }

    const offerIds = (payment.accepted_offer_ids as string[] | null) ?? [];
    if (offerIds.length > 0) {
      const { data: existingPaid } = await admin
        .from("payouts")
        .select("id")
        .in("offer_id", offerIds)
        .eq("status", "paid")
        .limit(1);
      // Still run disburse — it upserts and skips already-paid offers.
      void existingPaid;
    }

    try {
      await disbursePaymentToRefs(admin, payment.id);
      await admin
        .from("payments")
        .update({
          metadata: { ...meta, payoutDisbursedAt: nowIso, payoutHold: "released" },
          updated_at: nowIso,
        })
        .eq("id", payment.id);
      processed += 1;
    } catch (err) {
      failed += 1;
      console.error("[cron/disburse-after-events]", payment.id, err);
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, failed });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
