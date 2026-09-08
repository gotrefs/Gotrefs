import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";
import {
  OrganizerChargeError,
  refundOrganizerPayment,
} from "@/lib/stripe/charge-organizer-for-offer";
import { disbursePaymentToRefs } from "@/lib/stripe/payouts";

type PaymentOpsRow = {
  id: string;
  status: string;
  event_id: string | null;
  organizer_member_id: string;
  amount_total_cents: number;
  amount_subtotal_cents: number;
  platform_fee_cents: number;
  paid_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  accepted_offer_ids: string[] | null;
  metadata: Record<string, unknown> | null;
};

/** Recent organizer event payments for admin disburse / refund ops. */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, status, event_id, organizer_member_id, amount_total_cents, amount_subtotal_cents, platform_fee_cents, paid_at, created_at, stripe_payment_intent_id, accepted_offer_ids, metadata"
    )
    .eq("purpose", "event_refs")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (payments ?? []) as PaymentOpsRow[];
  const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
  const organizerIds = [...new Set(rows.map((r) => r.organizer_member_id))];
  const paymentIds = rows.map((r) => r.id);

  const [{ data: events }, { data: members }, { data: payouts }] = await Promise.all([
    eventIds.length
      ? admin.from("scheduled_events").select("id, title, sport, ends_at").in("id", eventIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; sport: string; ends_at: string | null }> }),
    organizerIds.length
      ? admin.from("members").select("id, display_name, email").in("id", organizerIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; display_name: string | null; email?: string | null }>,
        }),
    paymentIds.length
      ? admin
          .from("payouts")
          .select("id, payment_id, status, gross_cents, stripe_transfer_id, payee_member_id")
          .in("payment_id", paymentIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            payment_id: string | null;
            status: string;
            gross_cents: number;
            stripe_transfer_id: string | null;
            payee_member_id: string | null;
          }>,
        }),
  ]);

  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const payoutsByPayment = new Map<
    string,
    Array<{
      id: string;
      payment_id: string | null;
      status: string;
      gross_cents: number;
      stripe_transfer_id: string | null;
      payee_member_id: string | null;
    }>
  >();
  for (const p of payouts ?? []) {
    if (!p.payment_id) continue;
    const list = payoutsByPayment.get(p.payment_id) ?? [];
    list.push(p);
    payoutsByPayment.set(p.payment_id, list);
  }

  const now = Date.now();
  const payload = rows.map((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const event = row.event_id ? eventMap.get(row.event_id) : null;
    const org = memberMap.get(row.organizer_member_id);
    const related = payoutsByPayment.get(row.id) ?? [];
    const transferredCount = related.filter((p) => Boolean(p.stripe_transfer_id) || p.status === "paid").length;
    const heldCount = related.filter((p) =>
      ["pending", "pending_onboarding", "pending_tax", "processing"].includes(p.status)
    ).length;
    const disbursed = Boolean(meta.payoutDisbursedAt);
    const eventEnded = event?.ends_at != null && new Date(event.ends_at).getTime() <= now;
    const canDisburse = row.status === "paid" && !disbursed;
    const canRefund = (row.status === "paid" || row.status === "processing") && Boolean(row.stripe_payment_intent_id);

    return {
      id: row.id,
      status: row.status,
      eventId: row.event_id,
      eventTitle: event?.title ?? "Event",
      sport: event?.sport ?? null,
      endsAt: event?.ends_at ?? null,
      eventEnded,
      organizerName: org?.display_name?.trim() || "Organizer",
      organizerEmail: org?.email ?? null,
      amountTotalCents: row.amount_total_cents,
      amountSubtotalCents: row.amount_subtotal_cents,
      platformFeeCents: row.platform_fee_cents,
      paidAt: row.paid_at,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      offerCount: row.accepted_offer_ids?.length ?? 0,
      disbursed,
      payoutDisbursedAt: typeof meta.payoutDisbursedAt === "string" ? meta.payoutDisbursedAt : null,
      transferredCount,
      heldPayoutCount: heldCount,
      payoutCount: related.length,
      canDisburse,
      canRefund,
    };
  });

  return NextResponse.json({
    payments: payload,
    note: "Disburse sends Connect transfers to refs now (skips event-end wait). Full refund returns the organizer charge and resets offer payment status when no transfers exist.",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  let body: { paymentId?: string; action?: string; allowTransferred?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paymentId = body.paymentId?.trim();
  const action = body.action?.trim();
  if (!paymentId || !action) {
    return NextResponse.json({ error: "paymentId and action are required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  if (action === "disburse") {
    try {
      const { data: payment, error } = await admin
        .from("payments")
        .select("id, status, metadata")
        .eq("id", paymentId)
        .maybeSingle();
      if (error || !payment) {
        return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      }
      if (payment.status !== "paid") {
        return NextResponse.json({ error: "Only paid payments can be disbursed." }, { status: 400 });
      }

      const result = await disbursePaymentToRefs(admin, paymentId);
      const nowIso = new Date().toISOString();
      const meta = (payment.metadata || {}) as Record<string, unknown>;
      await admin
        .from("payments")
        .update({
          metadata: { ...meta, payoutDisbursedAt: nowIso, payoutHold: "released", adminDisbursedAt: nowIso },
          updated_at: nowIso,
        })
        .eq("id", paymentId);

      return NextResponse.json({ ok: true, action: "disburse", result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Disburse failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "refund") {
    try {
      const result = await refundOrganizerPayment(admin, {
        paymentId,
        allowTransferred: Boolean(body.allowTransferred),
      });
      return NextResponse.json({ ok: true, action: "refund", ...result });
    } catch (err) {
      if (err instanceof OrganizerChargeError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Refund failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action. Use disburse or refund." }, { status: 400 });
}
