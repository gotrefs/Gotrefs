import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connectReadyForPayout,
  type ConnectAccountRow,
} from "@/lib/stripe/connect";
import { getStripe, taxYearForDate } from "@/lib/stripe/client";

type PaymentRow = {
  id: string;
  organizer_member_id: string;
  event_id: string | null;
  vendor_id: string | null;
  purpose: string;
  amount_subtotal_cents: number;
  platform_fee_cents: number;
  amount_total_cents: number;
  accepted_offer_ids: string[];
  status: string;
};

async function getConnectForMember(admin: SupabaseClient, memberId: string) {
  const { data } = await admin
    .from("stripe_connect_accounts")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  return (data as ConnectAccountRow | null) ?? null;
}

async function upsertPayoutPending(
  admin: SupabaseClient,
  row: {
    payment_id: string;
    event_id: string | null;
    offer_id?: string | null;
    vendor_id?: string | null;
    payee_member_id: string | null;
    stripe_connect_account_id?: string | null;
    gross_cents: number;
    status: "pending" | "pending_onboarding" | "pending_tax" | "processing" | "paid" | "failed";
    failure_reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const payload = {
    payment_id: row.payment_id,
    event_id: row.event_id,
    offer_id: row.offer_id ?? null,
    vendor_id: row.vendor_id ?? null,
    payee_member_id: row.payee_member_id,
    stripe_connect_account_id: row.stripe_connect_account_id ?? null,
    gross_cents: row.gross_cents,
    status: row.status,
    tax_year: taxYearForDate(),
    failure_reason: row.failure_reason ?? null,
    metadata: row.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  if (row.offer_id) {
    const { data: existing } = await admin
      .from("payouts")
      .select("id, status, stripe_transfer_id")
      .eq("offer_id", row.offer_id)
      .maybeSingle();
    if (existing?.stripe_transfer_id || existing?.status === "paid") {
      return existing;
    }
    if (existing?.id) {
      const { data, error } = await admin
        .from("payouts")
        .update(payload)
        .eq("id", existing.id)
        .select("id, status, stripe_transfer_id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const { data, error } = await admin
    .from("payouts")
    .insert(payload)
    .select("id, status, stripe_transfer_id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function executeTransfer(args: {
  admin: SupabaseClient;
  payoutId: string;
  amountCents: number;
  destination: string;
  transferGroup?: string | null;
  metadata: Record<string, string>;
}) {
  const stripe = getStripe();
  const transfer = await stripe.transfers.create({
    amount: args.amountCents,
    currency: "usd",
    destination: args.destination,
    transfer_group: args.transferGroup || undefined,
    metadata: args.metadata,
  });

  const { error } = await args.admin
    .from("payouts")
    .update({
      stripe_transfer_id: transfer.id,
      status: "paid",
      paid_at: new Date().toISOString(),
      failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.payoutId);
  if (error) throw new Error(error.message);
  return transfer;
}

/**
 * After an organizer payment is marked paid, create Connect transfers for each accepted offer.
 * Holds as pending_onboarding / pending_tax when the ref is not ready.
 */
export async function disbursePaymentToRefs(admin: SupabaseClient, paymentId: string) {
  const { data: payment, error } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (error || !payment) throw new Error(error?.message || "Payment not found.");
  if (payment.status !== "paid") return { skipped: true as const, reason: "not_paid" };

  const pay = payment as PaymentRow;
  if (pay.purpose !== "event_refs" || !pay.event_id) {
    return { skipped: true as const, reason: "not_event_refs" };
  }

  const offerIds = pay.accepted_offer_ids ?? [];
  if (offerIds.length === 0) return { skipped: true as const, reason: "no_offers" };

  const { data: offers, error: offersError } = await admin
    .from("assignment_offers")
    .select("id, ref_member_id, offered_pay, event_id")
    .in("id", offerIds);
  if (offersError) throw new Error(offersError.message);

  const results: Array<{ offerId: string; status: string }> = [];

  for (const offer of offers ?? []) {
    const amountCents = Math.round(Number(offer.offered_pay || 0) * 100);
    if (amountCents <= 0) {
      results.push({ offerId: offer.id, status: "skipped_zero" });
      continue;
    }

    const connect = await getConnectForMember(admin, offer.ref_member_id);
    const ready = connectReadyForPayout(connect);

    if (!ready.ok) {
      const status =
        ready.reason === "pending_tax"
          ? "pending_tax"
          : ready.reason === "pending_onboarding" || ready.reason === "missing_account"
            ? "pending_onboarding"
            : "pending";
      await upsertPayoutPending(admin, {
        payment_id: pay.id,
        event_id: pay.event_id,
        offer_id: offer.id,
        payee_member_id: offer.ref_member_id,
        stripe_connect_account_id: connect?.stripe_account_id ?? null,
        gross_cents: amountCents,
        status,
        failure_reason:
          ready.reason === "pending_tax"
            ? "Tax ID (W-9) required before ACH payout."
            : "Complete Stripe Connect bank onboarding to receive ACH direct deposit.",
      });
      results.push({ offerId: offer.id, status });
      continue;
    }

    const payoutRow = await upsertPayoutPending(admin, {
      payment_id: pay.id,
      event_id: pay.event_id,
      offer_id: offer.id,
      payee_member_id: offer.ref_member_id,
      stripe_connect_account_id: connect!.stripe_account_id,
      gross_cents: amountCents,
      status: "processing",
    });

    try {
      await executeTransfer({
        admin,
        payoutId: payoutRow.id,
        amountCents,
        destination: connect!.stripe_account_id,
        transferGroup: pay.event_id,
        metadata: {
          payment_id: pay.id,
          offer_id: offer.id,
          event_id: pay.event_id,
          payee_member_id: offer.ref_member_id,
        },
      });

      await admin
        .from("assignment_offers")
        .update({ payment_status: "paid" })
        .eq("id", offer.id);
      await admin
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("offer_id", offer.id);

      results.push({ offerId: offer.id, status: "paid" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transfer failed.";
      await admin
        .from("payouts")
        .update({
          status: "failed",
          failure_reason: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutRow.id);
      results.push({ offerId: offer.id, status: "failed" });
    }
  }

  return { ok: true as const, results };
}

export async function disburseVendorPayment(admin: SupabaseClient, paymentId: string) {
  const { data: payment, error } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (error || !payment) throw new Error(error?.message || "Payment not found.");
  if (payment.status !== "paid" || payment.purpose !== "vendor" || !payment.vendor_id) {
    return { skipped: true as const };
  }

  const { data: vendor, error: vendorError } = await admin
    .from("vendors")
    .select("id, member_id, display_name")
    .eq("id", payment.vendor_id)
    .single();
  if (vendorError || !vendor?.member_id) {
    await upsertPayoutPending(admin, {
      payment_id: payment.id,
      event_id: null,
      vendor_id: payment.vendor_id,
      payee_member_id: null,
      gross_cents: payment.amount_subtotal_cents,
      status: "pending_onboarding",
      failure_reason: "Vendor has no linked member / Connect account yet.",
    });
    return { skipped: true as const, reason: "no_member" };
  }

  const connect = await getConnectForMember(admin, vendor.member_id);
  const ready = connectReadyForPayout(connect);
  const amountCents = payment.amount_subtotal_cents;

  if (!ready.ok) {
    await upsertPayoutPending(admin, {
      payment_id: payment.id,
      event_id: null,
      vendor_id: vendor.id,
      payee_member_id: vendor.member_id,
      stripe_connect_account_id: connect?.stripe_account_id ?? null,
      gross_cents: amountCents,
      status: ready.reason === "pending_tax" ? "pending_tax" : "pending_onboarding",
    });
    return { ok: true as const, status: ready.reason };
  }

  const payoutRow = await upsertPayoutPending(admin, {
    payment_id: payment.id,
    event_id: null,
    vendor_id: vendor.id,
    payee_member_id: vendor.member_id,
    stripe_connect_account_id: connect!.stripe_account_id,
    gross_cents: amountCents,
    status: "processing",
  });

  await executeTransfer({
    admin,
    payoutId: payoutRow.id,
    amountCents,
    destination: connect!.stripe_account_id,
    transferGroup: `vendor_${vendor.id}`,
    metadata: {
      payment_id: payment.id,
      vendor_id: vendor.id,
      payee_member_id: vendor.member_id,
    },
  });

  return { ok: true as const, status: "paid" };
}

/** Retry held payouts after a Connect account becomes ready. */
export async function retryHeldPayoutsForMember(admin: SupabaseClient, memberId: string) {
  const connect = await getConnectForMember(admin, memberId);
  const ready = connectReadyForPayout(connect);
  if (!ready.ok || !connect) return { retried: 0 };

  const { data: held } = await admin
    .from("payouts")
    .select("*")
    .eq("payee_member_id", memberId)
    .in("status", ["pending_onboarding", "pending_tax", "pending"])
    .is("stripe_transfer_id", null);

  let retried = 0;
  for (const row of held ?? []) {
    try {
      await admin
        .from("payouts")
        .update({
          status: "processing",
          stripe_connect_account_id: connect.stripe_account_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await executeTransfer({
        admin,
        payoutId: row.id,
        amountCents: row.gross_cents,
        destination: connect.stripe_account_id,
        transferGroup: row.event_id || (row.vendor_id ? `vendor_${row.vendor_id}` : undefined),
        metadata: {
          payout_id: row.id,
          payee_member_id: memberId,
          payment_id: row.payment_id || "",
        },
      });

      if (row.offer_id) {
        await admin.from("assignment_offers").update({ payment_status: "paid" }).eq("id", row.offer_id);
        await admin.from("bookings").update({ payment_status: "paid" }).eq("offer_id", row.offer_id);
      }
      retried += 1;
    } catch {
      // Leave failed state for ops review.
    }
  }

  return { retried };
}
