import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildConfirmPayBreakdown,
  type ConfirmPayBreakdown,
  type ConfirmPayOfferLine,
} from "@/lib/stripe/organizer-confirm-amount";
import {
  resolveOfferGamesWorked,
  resolveOfferRateCents,
} from "@/lib/stripe/offer-checkout-amount";
import { getOrganizerPaymentProfile } from "@/lib/stripe/organizer-payment-method";
import { disbursePaymentToRefs } from "@/lib/stripe/payouts";
import { getStripe } from "@/lib/stripe/client";

export class OrganizerChargeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "charge_failed") {
    super(message);
    this.name = "OrganizerChargeError";
    this.status = status;
    this.code = code;
  }
}

type DepositRow = {
  id: string;
  event_id: string;
  organizer_member_id: string;
  required_cents: number;
  collected_cents: number;
  applied_cents: number;
  refunded_cents: number;
  status: string;
  collections: unknown;
  refunded_at?: string | null;
};

type DepositCollection = {
  paymentId: string;
  paymentIntentId: string;
  amountCents: number;
};

function parseCollections(raw: unknown): DepositCollection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const paymentId = typeof r.paymentId === "string" ? r.paymentId : "";
      const paymentIntentId = typeof r.paymentIntentId === "string" ? r.paymentIntentId : "";
      const amountCents = Number(r.amountCents);
      if (!paymentId || !paymentIntentId || !Number.isFinite(amountCents) || amountCents <= 0) {
        return null;
      }
      return { paymentId, paymentIntentId, amountCents: Math.round(amountCents) };
    })
    .filter((x): x is DepositCollection => Boolean(x));
}

export function depositRefundableCents(row: {
  collected_cents: number;
  applied_cents: number;
  refunded_cents: number;
}) {
  return Math.max(0, row.collected_cents - row.applied_cents - row.refunded_cents);
}

export async function getEventDeposit(
  admin: SupabaseClient,
  eventId: string
): Promise<DepositRow | null> {
  const { data, error } = await admin
    .from("event_deposits")
    .select(
      "id, event_id, organizer_member_id, required_cents, collected_cents, applied_cents, refunded_cents, status, collections, refunded_at"
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    if (/event_deposits|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as DepositRow | null) ?? null;
}

async function loadUnpaidAcceptedOfferLines(
  admin: SupabaseClient,
  args: { eventId: string; offerIds?: string[] }
): Promise<{ event: { id: string; title: string; sport: string; pay_offer: number | null; organizer_member_id: string }; lines: ConfirmPayOfferLine[] }> {
  const { data: event, error: eventError } = await admin
    .from("scheduled_events")
    .select("id, title, sport, pay_offer, organizer_member_id")
    .eq("id", args.eventId)
    .single();

  if (eventError || !event?.organizer_member_id) {
    throw new OrganizerChargeError("Event not found.", 404, "event_not_found");
  }

  let query = admin
    .from("assignment_offers")
    .select("id, ref_member_id, event_id, offered_pay, games_count, payment_status, status")
    .eq("event_id", args.eventId)
    .eq("status", "accepted")
    .eq("payment_status", "unpaid");

  if (args.offerIds?.length) {
    query = query.in("id", args.offerIds);
  }

  const { data: offers, error: offersError } = await query;
  if (offersError) {
    throw new OrganizerChargeError(offersError.message, 500, "offers_load_failed");
  }
  if (!offers?.length) {
    throw new OrganizerChargeError(
      "No unpaid accepted offers to pay for this event.",
      400,
      "nothing_to_pay"
    );
  }

  const refIds = [...new Set(offers.map((o) => o.ref_member_id))];
  const { data: profiles } = await admin
    .from("ref_profiles")
    .select("member_id, rate_per_game, rate_min")
    .in("member_id", refIds);

  const profileByMember = new Map(
    (profiles ?? []).map((p) => [p.member_id as string, p] as const)
  );

  const lines: ConfirmPayOfferLine[] = offers.map((offer) => {
    const profile = profileByMember.get(offer.ref_member_id);
    const rateCents = resolveOfferRateCents({
      offeredPay: offer.offered_pay,
      refRatePerGame: profile?.rate_per_game ?? profile?.rate_min,
      eventPayOffer: event.pay_offer,
    });
    const gamesCount = resolveOfferGamesWorked(offer);
    return {
      offerId: offer.id,
      refMemberId: offer.ref_member_id,
      rateCents,
      gamesCount,
      refSubtotalCents: rateCents * gamesCount,
    };
  });

  if (lines.some((l) => l.refSubtotalCents <= 0)) {
    throw new OrganizerChargeError(
      "Could not resolve pay for an assignment. Set a per-game rate on the offer or event.",
      400,
      "missing_rate"
    );
  }

  return {
    event: {
      id: event.id,
      title: event.title,
      sport: event.sport,
      pay_offer: event.pay_offer,
      organizer_member_id: event.organizer_member_id,
    },
    lines,
  };
}

export async function previewConfirmEventPayment(
  admin: SupabaseClient,
  args: { eventId: string; offerIds?: string[] }
): Promise<{ breakdown: ConfirmPayBreakdown; deposit: DepositRow | null }> {
  const { lines } = await loadUnpaidAcceptedOfferLines(admin, args);
  const deposit = await getEventDeposit(admin, args.eventId);
  const breakdown = buildConfirmPayBreakdown({
    offers: lines,
    depositCollectedCents: deposit?.collected_cents ?? 0,
    depositRequiredCents: deposit?.required_cents ?? 0,
  });
  return { breakdown, deposit };
}

/**
 * Charge organizer saved PM for unpaid accepted offers on an event:
 * ref pay + 20% fee on ref pay only + deposit top-up (1 game × each ref, no fee).
 */
export async function confirmEventPayment(
  admin: SupabaseClient,
  args: {
    eventId: string;
    organizerMemberId: string;
    offerIds?: string[];
    /** When false (default), money is held until the event ends; cron disburses to refs. */
    disburseNow?: boolean;
  }
): Promise<{ paymentId: string; breakdown: ConfirmPayBreakdown; alreadyPaid: boolean }> {
  const { event, lines } = await loadUnpaidAcceptedOfferLines(admin, {
    eventId: args.eventId,
    offerIds: args.offerIds,
  });

  if (event.organizer_member_id !== args.organizerMemberId) {
    throw new OrganizerChargeError("Not authorized for this event.", 403, "forbidden");
  }

  const deposit = await getEventDeposit(admin, event.id);
  const breakdown = buildConfirmPayBreakdown({
    offers: lines,
    depositCollectedCents: deposit?.collected_cents ?? 0,
    depositRequiredCents: deposit?.required_cents ?? 0,
  });

  if (breakdown.totalCents <= 0) {
    throw new OrganizerChargeError("Nothing to charge.", 400, "nothing_to_pay");
  }

  const paymentProfile = await getOrganizerPaymentProfile(admin, args.organizerMemberId);
  if (!paymentProfile?.stripe_customer_id || !paymentProfile.default_payment_method_id) {
    throw new OrganizerChargeError(
      "Add a card or bank under Payments before confirming pay.",
      402,
      "missing_payment_method"
    );
  }

  const now = new Date().toISOString();
  const offerIds = breakdown.offers.map((o) => o.offerId);
  const metadata = {
    purpose: "event_refs",
    eventId: event.id,
    organizerMemberId: args.organizerMemberId,
    acceptedOfferIds: offerIds.join(","),
    refCount: String(breakdown.refCount),
    refSubtotalCents: String(breakdown.refSubtotalCents),
    platformFeeCents: String(breakdown.platformFeeCents),
    depositCents: String(breakdown.depositCents),
  };

  const { data: payment, error: paymentInsertError } = await admin
    .from("payments")
    .insert({
      organizer_member_id: args.organizerMemberId,
      event_id: event.id,
      purpose: "event_refs",
      amount_total_cents: breakdown.totalCents,
      amount_subtotal_cents: breakdown.refSubtotalCents,
      platform_fee_cents: breakdown.platformFeeCents,
      status: "processing",
      accepted_offer_ids: offerIds,
      metadata: {
        ...metadata,
        depositCents: breakdown.depositCents,
        payoutHold: args.disburseNow ? "immediate" : "until_event_end",
      },
    })
    .select("id")
    .single();

  if (paymentInsertError || !payment) {
    throw new OrganizerChargeError(
      paymentInsertError?.message || "Could not create payment ledger row.",
      500,
      "ledger_failed"
    );
  }

  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.create({
      amount: breakdown.totalCents,
      currency: "usd",
      customer: paymentProfile.stripe_customer_id,
      payment_method: paymentProfile.default_payment_method_id,
      off_session: true,
      confirm: true,
      transfer_group: event.id,
      metadata: {
        ...metadata,
        paymentId: payment.id,
      },
      description: `${event.title || "GotRefs event"} · ${breakdown.refCount} ref${breakdown.refCount === 1 ? "" : "s"} + deposit`,
    });

    if (intent.status !== "succeeded" && intent.status !== "processing") {
      await admin
        .from("payments")
        .update({ status: "failed", updated_at: now })
        .eq("id", payment.id);
      throw new OrganizerChargeError(
        `Payment could not be completed (status: ${intent.status}). Update your payment method and try again.`,
        402,
        "payment_incomplete"
      );
    }

    await admin
      .from("payments")
      .update({
        status: "paid",
        stripe_payment_intent_id: intent.id,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", payment.id);

    await admin
      .from("assignment_offers")
      .update({ payment_status: "paid" })
      .in("id", offerIds);

    if (breakdown.depositCents > 0 || !deposit) {
      const collections = parseCollections(deposit?.collections);
      if (breakdown.depositCents > 0) {
        collections.push({
          paymentId: payment.id,
          paymentIntentId: intent.id,
          amountCents: breakdown.depositCents,
        });
      }
      const nextCollected = (deposit?.collected_cents ?? 0) + breakdown.depositCents;
      const nextRequired = breakdown.depositRequiredAfterCents;
      const depositStatus =
        nextCollected <= 0
          ? "pending"
          : deposit && deposit.applied_cents > 0
            ? "partially_used"
            : "held";

      const depositPayload = {
        event_id: event.id,
        organizer_member_id: args.organizerMemberId,
        required_cents: nextRequired,
        collected_cents: nextCollected,
        applied_cents: deposit?.applied_cents ?? 0,
        refunded_cents: deposit?.refunded_cents ?? 0,
        status: depositStatus,
        collections,
        updated_at: now,
      };

      if (deposit?.id) {
        const { error: depErr } = await admin
          .from("event_deposits")
          .update(depositPayload)
          .eq("id", deposit.id);
        if (depErr) console.error("[confirm-event-payment] deposit update failed:", depErr);
      } else {
        const { error: depErr } = await admin.from("event_deposits").insert(depositPayload);
        if (depErr) console.error("[confirm-event-payment] deposit insert failed:", depErr);
      }
    } else if (deposit?.id && breakdown.depositRequiredAfterCents > deposit.required_cents) {
      await admin
        .from("event_deposits")
        .update({
          required_cents: breakdown.depositRequiredAfterCents,
          updated_at: now,
        })
        .eq("id", deposit.id);
    }

    if (args.disburseNow) {
      try {
        await disbursePaymentToRefs(admin, payment.id);
      } catch (err) {
        console.error("[confirm-event-payment] disburse failed:", err);
      }
    }

    return { paymentId: payment.id, breakdown, alreadyPaid: false };
  } catch (err) {
    if (err instanceof OrganizerChargeError) throw err;

    await admin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id);

    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not charge your payment method.";
    throw new OrganizerChargeError(message, 402, "stripe_error");
  }
}

/**
 * Legacy single-offer charge — prefer confirmEventPayment for deposit + batch.
 * Kept for any callers that still pass one offer without event confirm UI.
 */
export async function chargeOrganizerForOffer(
  admin: SupabaseClient,
  args: { offerId: string }
): Promise<{ paymentId: string; alreadyPaid: boolean }> {
  const { data: offer, error } = await admin
    .from("assignment_offers")
    .select("id, event_id, payment_status")
    .eq("id", args.offerId)
    .single();

  if (error || !offer) {
    throw new OrganizerChargeError("Offer not found.", 404, "offer_not_found");
  }

  if (offer.payment_status === "paid") {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .contains("accepted_offer_ids", [offer.id])
      .eq("status", "paid")
      .maybeSingle();
    return { paymentId: existing?.id ?? "", alreadyPaid: true };
  }

  const { data: event } = await admin
    .from("scheduled_events")
    .select("organizer_member_id")
    .eq("id", offer.event_id)
    .single();

  if (!event?.organizer_member_id) {
    throw new OrganizerChargeError("Event not found for this offer.", 404, "event_not_found");
  }

  const result = await confirmEventPayment(admin, {
    eventId: offer.event_id,
    organizerMemberId: event.organizer_member_id,
    offerIds: [offer.id],
  });
  return { paymentId: result.paymentId, alreadyPaid: result.alreadyPaid };
}

export async function refundEventDeposit(
  admin: SupabaseClient,
  args: { eventId: string; organizerMemberId?: string; force?: boolean }
): Promise<{ refundedCents: number; alreadyRefunded: boolean }> {
  const deposit = await getEventDeposit(admin, args.eventId);
  if (!deposit) {
    return { refundedCents: 0, alreadyRefunded: true };
  }
  if (args.organizerMemberId && deposit.organizer_member_id !== args.organizerMemberId) {
    throw new OrganizerChargeError("Not authorized for this deposit.", 403, "forbidden");
  }

  const refundable = depositRefundableCents(deposit);
  if (refundable <= 0) {
    return { refundedCents: 0, alreadyRefunded: true };
  }

  if (!args.force) {
    const { data: event } = await admin
      .from("scheduled_events")
      .select("ends_at")
      .eq("id", args.eventId)
      .maybeSingle();
    if (event?.ends_at && new Date(event.ends_at).getTime() > Date.now()) {
      throw new OrganizerChargeError(
        "Deposit can be refunded after the event ends.",
        400,
        "event_not_ended"
      );
    }
  }

  const collections = parseCollections(deposit.collections);
  const stripe = getStripe();
  let remaining = refundable;
  let refunded = 0;

  for (let i = collections.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const col = collections[i];
    const amount = Math.min(remaining, col.amountCents);
    if (amount <= 0) continue;
    try {
      await stripe.refunds.create({
        payment_intent: col.paymentIntentId,
        amount,
        reason: "requested_by_customer",
        metadata: {
          purpose: "event_deposit_refund",
          eventId: args.eventId,
          depositId: deposit.id,
        },
      });
      refunded += amount;
      remaining -= amount;
    } catch (err) {
      console.error("[refund-event-deposit] stripe refund failed:", err);
      throw new OrganizerChargeError(
        err instanceof Error ? err.message : "Could not refund deposit.",
        402,
        "refund_failed"
      );
    }
  }

  if (refunded <= 0) {
    throw new OrganizerChargeError("Could not refund deposit.", 402, "refund_failed");
  }

  const now = new Date().toISOString();
  const nextRefunded = deposit.refunded_cents + refunded;
  const stillHeld = depositRefundableCents({
    collected_cents: deposit.collected_cents,
    applied_cents: deposit.applied_cents,
    refunded_cents: nextRefunded,
  });

  await admin
    .from("event_deposits")
    .update({
      refunded_cents: nextRefunded,
      status: stillHeld > 0 ? "partially_used" : "refunded",
      refunded_at: stillHeld > 0 ? deposit.refunded_at : now,
      updated_at: now,
    })
    .eq("id", deposit.id);

  return { refundedCents: refunded, alreadyRefunded: false };
}
