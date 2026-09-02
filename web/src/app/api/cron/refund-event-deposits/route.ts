import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  OrganizerChargeError,
  refundEventDeposit,
} from "@/lib/stripe/charge-organizer-for-offer";

/**
 * Auto-refund unused event deposits after the event has ended.
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
  const { data: deposits, error } = await admin
    .from("event_deposits")
    .select("id, event_id, collected_cents, applied_cents, refunded_cents, status")
    .in("status", ["held", "partially_used"])
    .limit(50);

  if (error) {
    if (/event_deposits|does not exist/i.test(error.message)) {
      return NextResponse.json({ ok: true, processed: 0, skipped: 0, note: "table_missing" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let skipped = 0;
  let refundedCents = 0;

  for (const row of deposits ?? []) {
    const refundable = Math.max(
      0,
      Number(row.collected_cents) - Number(row.applied_cents) - Number(row.refunded_cents)
    );
    if (refundable <= 0) {
      skipped += 1;
      continue;
    }

    const { data: event } = await admin
      .from("scheduled_events")
      .select("ends_at")
      .eq("id", row.event_id)
      .maybeSingle();

    if (!event?.ends_at || event.ends_at > nowIso) {
      skipped += 1;
      continue;
    }

    try {
      const result = await refundEventDeposit(admin, { eventId: row.event_id, force: true });
      if (result.refundedCents > 0) {
        processed += 1;
        refundedCents += result.refundedCents;
      } else {
        skipped += 1;
      }
    } catch (err) {
      skipped += 1;
      if (!(err instanceof OrganizerChargeError)) {
        console.error("[cron/refund-event-deposits]", row.event_id, err);
      }
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, refundedCents });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
