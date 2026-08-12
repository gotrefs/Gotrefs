import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_FEE_PERCENT_LABEL } from "@/lib/platform-fee";
import { taxYearForDate } from "@/lib/stripe/client";

export type PaymentLineItem = {
  payoutId: string | null;
  offerId: string | null;
  payeeMemberId: string | null;
  payeeName: string;
  grossCents: number;
  status: string;
};

export type OrganizerPaymentDetail = {
  id: string;
  status: string;
  purpose: string;
  currency: string;
  eventId: string | null;
  eventTitle: string | null;
  eventStartsAt: string | null;
  vendorId: string | null;
  amountSubtotalCents: number;
  platformFeeCents: number;
  amountTotalCents: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: PaymentLineItem[];
};

type PaymentRow = {
  id: string;
  status: string;
  purpose: string;
  currency: string;
  event_id: string | null;
  vendor_id: string | null;
  amount_subtotal_cents: number;
  platform_fee_cents: number;
  amount_total_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  accepted_offer_ids: string[] | null;
};

type PayoutRow = {
  id: string;
  payment_id: string | null;
  offer_id: string | null;
  payee_member_id: string | null;
  gross_cents: number;
  status: string;
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function loadOrganizerPayments(
  admin: SupabaseClient,
  organizerMemberId: string,
  opts?: { paymentId?: string; year?: number }
): Promise<OrganizerPaymentDetail[]> {
  let query = admin
    .from("payments")
    .select(
      "id, status, purpose, currency, event_id, vendor_id, amount_subtotal_cents, platform_fee_cents, amount_total_cents, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at, accepted_offer_ids"
    )
    .eq("organizer_member_id", organizerMemberId)
    .order("created_at", { ascending: false });

  if (opts?.paymentId) {
    query = query.eq("id", opts.paymentId);
  }

  const { data: payments, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (payments ?? []) as PaymentRow[];
  if (opts?.year != null) {
    rows = rows.filter((row) => {
      const stamp = row.paid_at || row.created_at;
      return taxYearForDate(new Date(stamp)) === opts.year;
    });
  }

  if (rows.length === 0) return [];

  const paymentIds = rows.map((r) => r.id);
  const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
  const offerIds = [...new Set(rows.flatMap((r) => r.accepted_offer_ids ?? []))];

  const [{ data: payouts }, { data: events }, { data: offers }] = await Promise.all([
    admin
      .from("payouts")
      .select("id, payment_id, offer_id, payee_member_id, gross_cents, status")
      .in("payment_id", paymentIds),
    eventIds.length
      ? admin.from("scheduled_events").select("id, title, starts_at").in("id", eventIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; starts_at: string }> }),
    offerIds.length
      ? admin.from("assignment_offers").select("id, ref_member_id, offered_pay").in("id", offerIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; ref_member_id: string; offered_pay: number | null }>,
        }),
  ]);

  const payeeIds = [
    ...new Set(
      [
        ...(payouts ?? []).map((p) => p.payee_member_id),
        ...(offers ?? []).map((o) => o.ref_member_id),
      ].filter(Boolean) as string[]
    ),
  ];

  const { data: members } = payeeIds.length
    ? await admin.from("members").select("id, display_name").in("id", payeeIds)
    : { data: [] as Array<{ id: string; display_name: string | null }> };

  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.display_name || "Official"]));
  const offerMap = new Map((offers ?? []).map((o) => [o.id, o]));
  const payoutsByPayment = new Map<string, PayoutRow[]>();
  for (const payout of (payouts ?? []) as PayoutRow[]) {
    if (!payout.payment_id) continue;
    const list = payoutsByPayment.get(payout.payment_id) ?? [];
    list.push(payout);
    payoutsByPayment.set(payout.payment_id, list);
  }

  return rows.map((row) => {
    const event = row.event_id ? eventMap.get(row.event_id) : null;
    const relatedPayouts = payoutsByPayment.get(row.id) ?? [];
    let lineItems: PaymentLineItem[] = relatedPayouts.map((payout) => ({
      payoutId: payout.id,
      offerId: payout.offer_id,
      payeeMemberId: payout.payee_member_id,
      payeeName: payout.payee_member_id
        ? memberMap.get(payout.payee_member_id) || "Official"
        : "Vendor / payee",
      grossCents: payout.gross_cents,
      status: payout.status,
    }));

    if (lineItems.length === 0 && (row.accepted_offer_ids?.length ?? 0) > 0) {
      lineItems = (row.accepted_offer_ids ?? []).map((offerId) => {
        const offer = offerMap.get(offerId);
        const cents = Math.round(Number(offer?.offered_pay ?? 0) * 100);
        return {
          payoutId: null,
          offerId,
          payeeMemberId: offer?.ref_member_id ?? null,
          payeeName: offer?.ref_member_id
            ? memberMap.get(offer.ref_member_id) || "Official"
            : "Official",
          grossCents: cents,
          status: row.status === "paid" ? "pending" : row.status,
        };
      });
    }

    return {
      id: row.id,
      status: row.status,
      purpose: row.purpose,
      currency: row.currency,
      eventId: row.event_id,
      eventTitle: event?.title ?? null,
      eventStartsAt: event?.starts_at ?? null,
      vendorId: row.vendor_id,
      amountSubtotalCents: row.amount_subtotal_cents,
      platformFeeCents: row.platform_fee_cents,
      amountTotalCents: row.amount_total_cents,
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      lineItems,
    };
  });
}

export function buildTaxSummary(payments: OrganizerPaymentDetail[], year: number) {
  const paid = payments.filter((p) => p.status === "paid" || p.status === "processing");
  const byEvent = new Map<
    string,
    {
      eventId: string | null;
      eventTitle: string;
      paymentCount: number;
      subtotalCents: number;
      feeCents: number;
      totalCents: number;
    }
  >();

  let subtotalCents = 0;
  let feeCents = 0;
  let totalCents = 0;

  for (const payment of paid) {
    subtotalCents += payment.amountSubtotalCents;
    feeCents += payment.platformFeeCents;
    totalCents += payment.amountTotalCents;
    const key = payment.eventId || payment.id;
    const current = byEvent.get(key) ?? {
      eventId: payment.eventId,
      eventTitle: payment.eventTitle || (payment.purpose === "vendor" ? "Vendor payment" : "Payment"),
      paymentCount: 0,
      subtotalCents: 0,
      feeCents: 0,
      totalCents: 0,
    };
    current.paymentCount += 1;
    current.subtotalCents += payment.amountSubtotalCents;
    current.feeCents += payment.platformFeeCents;
    current.totalCents += payment.amountTotalCents;
    byEvent.set(key, current);
  }

  return {
    year,
    paymentCount: paid.length,
    amountSubtotalCents: subtotalCents,
    platformFeeCents: feeCents,
    amountTotalCents: totalCents,
    events: [...byEvent.values()].sort((a, b) => b.totalCents - a.totalCents),
    payments: paid,
  };
}

export function taxSummaryToCsv(
  summary: ReturnType<typeof buildTaxSummary>
): string {
  const header = [
    "year",
    "payment_id",
    "paid_at",
    "event_title",
    "purpose",
    "status",
    "ref_pay_dollars",
    "platform_fee_dollars",
    "total_charged_dollars",
    "stripe_payment_intent_id",
    "line_items",
  ];
  const lines = [
    header.join(","),
    ...summary.payments.map((p) => {
      const lineItems = p.lineItems
        .map((li) => `${li.payeeName}:$${money(li.grossCents)}`)
        .join("; ");
      return [
        summary.year,
        p.id,
        JSON.stringify(p.paidAt || p.createdAt),
        JSON.stringify(p.eventTitle || ""),
        p.purpose,
        p.status,
        money(p.amountSubtotalCents),
        money(p.platformFeeCents),
        money(p.amountTotalCents),
        p.stripePaymentIntentId || p.stripeCheckoutSessionId || "",
        JSON.stringify(lineItems),
      ].join(",");
    }),
  ];
  return lines.join("\n");
}

export function receiptToHtml(payment: OrganizerPaymentDetail): string {
  const paidLabel = payment.paidAt
    ? new Date(payment.paidAt).toLocaleString()
    : new Date(payment.createdAt).toLocaleString();
  const rows = payment.lineItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.payeeName)}</td><td>${escapeHtml(item.status)}</td><td style="text-align:right">$${money(item.grossCents)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GotRefs payment receipt</title>
  <style>
    body { font-family: Georgia, serif; color: #0f172a; margin: 40px; }
    h1 { font-size: 28px; margin: 0; }
    .muted { color: #64748b; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .totals { margin-top: 24px; max-width: 320px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals .grand { font-weight: 700; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 10px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Print / Save PDF</button>
  <h1>GotRefs</h1>
  <p class="muted">Payment receipt for organizer tax records</p>
  <p><strong>Receipt ID:</strong> ${escapeHtml(payment.id)}</p>
  <p><strong>Status:</strong> ${escapeHtml(payment.status)}</p>
  <p><strong>Date:</strong> ${escapeHtml(paidLabel)}</p>
  <p><strong>Event:</strong> ${escapeHtml(payment.eventTitle || "—")}</p>
  <p><strong>Stripe reference:</strong> ${escapeHtml(
    payment.stripePaymentIntentId || payment.stripeCheckoutSessionId || "—"
  )}</p>
  <table>
    <thead><tr><th>Payee</th><th>Payout status</th><th>Amount</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3">No line items</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <div><span>Officials / payees</span><span>$${money(payment.amountSubtotalCents)}</span></div>
    <div><span>GotRefs fee (${PLATFORM_FEE_PERCENT_LABEL})</span><span>$${money(payment.platformFeeCents)}</span></div>
    <div class="grand"><span>Total charged</span><span>$${money(payment.amountTotalCents)}</span></div>
  </div>
  <p class="muted" style="margin-top:32px">
    This document is an expense receipt for amounts you paid through GotRefs. It is not a 1099.
    Officials who received payouts may receive 1099-NEC forms from Stripe Tax Reporting when thresholds are met.
  </p>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
