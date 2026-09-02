import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { upsertConnectAccountFromStripe } from "@/lib/stripe/connect";
import { disbursePaymentToRefs, disburseVendorPayment, retryHeldPayoutsForMember } from "@/lib/stripe/payouts";
import { saveOrganizerDefaultPaymentMethod } from "@/lib/stripe/organizer-payment-method";

async function markWebhookProcessed(
  admin: SupabaseClient,
  event: Stripe.Event,
  payload: Record<string, unknown> = {}
) {
  await admin.from("stripe_webhook_events").upsert(
    {
      id: event.id,
      type: event.type,
      processed_at: new Date().toISOString(),
      payload,
    },
    { onConflict: "id" }
  );
}

async function alreadyProcessed(admin: SupabaseClient, eventId: string) {
  const { data } = await admin.from("stripe_webhook_events").select("id").eq("id", eventId).maybeSingle();
  return Boolean(data?.id);
}

async function markPaymentPaidFromCheckout(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const sessionId = session.id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const meta = session.metadata || {};
  const metaPaymentId = meta.paymentId?.trim() || null;

  let existing = null as Record<string, unknown> | null;
  if (metaPaymentId) {
    const byId = await admin.from("payments").select("*").eq("id", metaPaymentId).maybeSingle();
    existing = byId.data;
  }
  if (!existing) {
    const bySession = await admin
      .from("payments")
      .select("*")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    existing = bySession.data;
  }

  const now = new Date().toISOString();
  let paymentId = existing?.id as string | undefined;

  if (existing) {
    if (existing.status === "paid") {
      return existing;
    }
    const { data, error } = await admin
      .from("payments")
      .update({
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
        paid_at: now,
        updated_at: now,
        amount_total_cents: session.amount_total ?? existing.amount_total_cents,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    paymentId = data.id;
  } else {
    const offerIds = (meta.acceptedOfferIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const { data, error } = await admin
      .from("payments")
      .insert({
        organizer_member_id: meta.organizerMemberId || null,
        event_id: meta.eventId || null,
        vendor_id: meta.vendorId || null,
        purpose: meta.purpose === "vendor" ? "vendor" : "event_refs",
        stripe_checkout_session_id: sessionId,
        stripe_payment_intent_id: paymentIntentId,
        amount_total_cents: session.amount_total ?? 0,
        amount_subtotal_cents: Number(meta.refSubtotalCents || meta.vendorSubtotalCents || 0),
        platform_fee_cents: Number(meta.platformFeeCents || 0),
        status: "paid",
        accepted_offer_ids: offerIds,
        paid_at: now,
        metadata: meta,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    paymentId = data.id;
  }

  if (!paymentId) throw new Error("Could not resolve payment id.");

  const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).single();
  if (!payment) throw new Error("Payment missing after update.");

  if (payment.purpose === "vendor") {
    await disburseVendorPayment(admin, payment.id);
  } else {
    await disbursePaymentToRefs(admin, payment.id);
  }

  return payment;
}

export async function handleStripeWebhookEvent(admin: SupabaseClient, event: Stripe.Event) {
  if (await alreadyProcessed(admin, event.id)) {
    return { ok: true, duplicate: true };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.status === "complete") {
        await markPaymentPaidFromCheckout(admin, session);
      }
      break;
    }
    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const memberId = setupIntent.metadata?.member_id?.trim();
      const customerId =
        typeof setupIntent.customer === "string"
          ? setupIntent.customer
          : setupIntent.customer?.id ?? null;
      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method?.id ?? null;
      if (memberId && customerId && paymentMethodId) {
        await saveOrganizerDefaultPaymentMethod(admin, {
          memberId,
          customerId,
          paymentMethodId,
        });
      }
      break;
    }
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const memberId = account.metadata?.member_id;
      if (memberId) {
        await upsertConnectAccountFromStripe(admin, memberId, account);
        await retryHeldPayoutsForMember(admin, memberId);
      } else {
        const { data: row } = await admin
          .from("stripe_connect_accounts")
          .select("member_id")
          .eq("stripe_account_id", account.id)
          .maybeSingle();
        if (row?.member_id) {
          await upsertConnectAccountFromStripe(admin, row.member_id, account);
          await retryHeldPayoutsForMember(admin, row.member_id);
        }
      }
      break;
    }
    case "transfer.created":
    case "transfer.updated":
    case "transfer.reversed":
    case "payout.paid":
    case "payout.failed":
    case "payment_intent.succeeded":
      // Ledger updates for transfers happen in disburse*; these are acknowledged for idempotency.
      break;
    default:
      break;
  }

  await markWebhookProcessed(admin, event, { type: event.type });
  return { ok: true };
}
