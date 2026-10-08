import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { emailSiteUrl } from "@/lib/email/resend";
import {
  notifyOrganizerExtraChargeFailed,
  notifyOrganizerTimesheetSettled,
  notifyPayoutMethodNeeded,
} from "@/lib/email/notifications";
import { connectReadyForPayout } from "@/lib/stripe/connect";
import { getStripe } from "@/lib/stripe/client";
import {
  resolveOfferGamesWorked,
  resolveOfferRateCents,
} from "@/lib/stripe/offer-checkout-amount";
import { getOrganizerPaymentProfile } from "@/lib/stripe/organizer-payment-method";
import {
  executeTransfer,
  getConnectForMember,
  upsertPayoutPending,
} from "@/lib/stripe/payouts";
import { platformFeeCents } from "@/lib/platform-fee";
import {
  AUTO_APPROVE_MS,
  settlementCents,
  unitLabel,
  type Timesheet,
} from "@/lib/timesheets";

export type SettleResult =
  | {
      status: "settled";
      refPayCents: number;
      adjustCents: number;
      adjustStatus: string;
      payout: string;
    }
  | { status: "skipped"; reason: string };

type BookingRow = {
  id: string;
  offer_id: string | null;
  event_id: string;
  ref_member_id: string;
  organizer_member_id: string;
  status: string;
};

type OfferRow = {
  id: string;
  offered_pay: number | null;
  games_count?: number | null;
};

type PaymentRow = {
  id: string;
  stripe_payment_intent_id: string | null;
  status: string;
};

const skip = (reason: string): SettleResult => ({ status: "skipped", reason });

async function chargeIdForIntent(
  stripe: Stripe,
  paymentIntentId: string | null,
) {
  if (!paymentIntentId) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const charge = intent.latest_charge;
    return typeof charge === "string" ? charge : (charge?.id ?? null);
  } catch {
    return null;
  }
}

/**
 * Settle one booking once its timesheet is approved: pay the REF for the work they did,
 * then charge the organizer for extra work or refund unused work (plus the 20% on it).
 * Runs at most once per booking (claimed with settled_at). If the extra charge fails the REF
 * is still paid and the organizer is asked for another card.
 */
export async function settleBooking(
  admin: SupabaseClient,
  bookingId: string,
): Promise<SettleResult> {
  const { data: sheetData, error: sheetError } = await admin
    .from("booking_timesheets")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (sheetError) return skip(`timesheet: ${sheetError.message}`);
  const sheet = sheetData as Timesheet | null;
  if (!sheet) return skip("no_timesheet");
  if (sheet.settled_at) return skip("already_settled");
  if (sheet.status !== "approved") return skip(`not_approved:${sheet.status}`);

  const { data: bookingData } = await admin
    .from("bookings")
    .select(
      "id, offer_id, event_id, ref_member_id, organizer_member_id, status",
    )
    .eq("id", bookingId)
    .maybeSingle();
  const booking = bookingData as BookingRow | null;
  if (!booking?.offer_id) return skip("no_booking");
  if (booking.status === "canceled") return skip("booking_canceled");

  // Already paid out the old way (before timesheets)? Never pay twice.
  const { data: priorPayout } = await admin
    .from("payouts")
    .select("id, status, stripe_transfer_id")
    .eq("offer_id", booking.offer_id)
    .maybeSingle();
  if (priorPayout?.stripe_transfer_id || priorPayout?.status === "paid")
    return skip("already_paid_out");

  const { data: offerData } = await admin
    .from("assignment_offers")
    .select("id, offered_pay, games_count")
    .eq("id", booking.offer_id)
    .maybeSingle();
  const offer = offerData as OfferRow | null;
  if (!offer) return skip("no_offer");

  const { data: paymentData } = await admin
    .from("payments")
    .select("id, stripe_payment_intent_id, status")
    .eq("purpose", "event_refs")
    .eq("status", "paid")
    .contains("accepted_offer_ids", [offer.id])
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payment = paymentData as PaymentRow | null;
  if (!payment) return skip("organizer_not_charged");

  const [{ data: profile }, { data: event }] = await Promise.all([
    admin
      .from("ref_profiles")
      .select("rate_per_game, rate_min")
      .eq("member_id", booking.ref_member_id)
      .maybeSingle(),
    admin
      .from("scheduled_events")
      .select("title, pay_offer")
      .eq("id", booking.event_id)
      .maybeSingle(),
  ]);
  // Same rate and units the organizer was charged for up front.
  const rateCents = resolveOfferRateCents({
    offeredPay: offer.offered_pay,
    refRatePerGame: profile?.rate_per_game ?? profile?.rate_min,
    eventPayOffer: event?.pay_offer,
  });
  const bookedUnits = resolveOfferGamesWorked(offer);
  const workedUnits = Number(sheet.worked_units ?? bookedUnits);
  const money = settlementCents({ rateCents, bookedUnits, workedUnits });
  if (rateCents <= 0) return skip("missing_rate");

  // Claim it: only one caller (REF approval, organizer clock-out, or the daily sweep) settles.
  const nowIso = new Date().toISOString();
  const { data: claimed } = await admin
    .from("booking_timesheets")
    .update({ settled_at: nowIso, updated_at: nowIso })
    .eq("booking_id", bookingId)
    .is("settled_at", null)
    .eq("status", "approved")
    .select("booking_id");
  if (!claimed?.length) return skip("already_settled");

  const stripe = getStripe();
  const unit = sheet.pay_unit;
  const summary = `${unitLabel(unit, workedUnits)} worked, ${unitLabel(unit, bookedUnits)} booked`;
  const siteUrl = emailSiteUrl();
  let adjustStatus: NonNullable<Timesheet["adjust_status"]> = "none";
  let adjustPaymentId: string | null = null;
  let extraChargeId: string | null = null;
  const errors: string[] = [];

  // 1) Organizer: charge extra work or refund unused work.
  if (money.adjustCents > 0) {
    const profileRow = await getOrganizerPaymentProfile(
      admin,
      booking.organizer_member_id,
    );
    const { data: extraPayment } = await admin
      .from("payments")
      .insert({
        organizer_member_id: booking.organizer_member_id,
        event_id: booking.event_id,
        purpose: "other",
        amount_total_cents: money.adjustCents,
        amount_subtotal_cents: money.diffCents,
        platform_fee_cents: platformFeeCents(money.diffCents),
        status: "processing",
        accepted_offer_ids: [offer.id],
        metadata: { kind: "timesheet_extra", bookingId, summary },
      })
      .select("id")
      .single();
    adjustPaymentId = extraPayment?.id ?? null;
    try {
      if (
        !profileRow?.stripe_customer_id ||
        !profileRow.default_payment_method_id
      ) {
        throw new Error("No card on file.");
      }
      const intent = await stripe.paymentIntents.create(
        {
          amount: money.adjustCents,
          currency: "usd",
          customer: profileRow.stripe_customer_id,
          payment_method: profileRow.default_payment_method_id,
          off_session: true,
          confirm: true,
          transfer_group: booking.event_id,
          description: `${event?.title || "GotREFS event"} · extra REF work (${summary})`,
          metadata: {
            purpose: "timesheet_extra",
            bookingId,
            offerId: offer.id,
            paymentId: adjustPaymentId ?? "",
          },
        },
        { idempotencyKey: `settle-extra-${bookingId}` },
      );
      if (intent.status !== "succeeded" && intent.status !== "processing") {
        throw new Error(`Charge status ${intent.status}`);
      }
      extraChargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : (intent.latest_charge?.id ?? null);
      adjustStatus = "charged";
      if (adjustPaymentId) {
        await admin
          .from("payments")
          .update({
            status: "paid",
            stripe_payment_intent_id: intent.id,
            paid_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", adjustPaymentId);
      }
    } catch (err) {
      adjustStatus = "charge_failed";
      errors.push(
        `extra charge: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (adjustPaymentId) {
        await admin
          .from("payments")
          .update({ status: "failed", updated_at: nowIso })
          .eq("id", adjustPaymentId);
      }
    }
  } else if (money.adjustCents < 0) {
    try {
      if (!payment.stripe_payment_intent_id)
        throw new Error("Original charge has no payment intent.");
      await stripe.refunds.create(
        {
          payment_intent: payment.stripe_payment_intent_id,
          amount: -money.adjustCents,
          reason: "requested_by_customer",
          metadata: {
            purpose: "timesheet_unused_work",
            bookingId,
            offerId: offer.id,
          },
        },
        { idempotencyKey: `settle-refund-${bookingId}` },
      );
      adjustStatus = "refunded";
    } catch (err) {
      adjustStatus = "refund_failed";
      errors.push(
        `refund: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 2) REF: pay for the work they did. Paid out of the organizer's charges so it can go
  //    out right away; if the extra charge failed, GotREFS covers that part from its balance.
  let payoutState = "none";
  try {
    if (money.refPayCents > 0) {
      const connect = await getConnectForMember(admin, booking.ref_member_id);
      const ready = connectReadyForPayout(connect);
      if (!ready.ok) {
        payoutState =
          ready.reason === "pending_tax" ? "pending_tax" : "pending_onboarding";
        await upsertPayoutPending(admin, {
          payment_id: payment.id,
          event_id: booking.event_id,
          offer_id: offer.id,
          payee_member_id: booking.ref_member_id,
          stripe_connect_account_id: connect?.stripe_account_id ?? null,
          gross_cents: money.refPayCents,
          status: payoutState as "pending_tax" | "pending_onboarding",
          failure_reason:
            ready.reason === "pending_tax"
              ? "Tax ID (W-9) required before ACH payout."
              : "Complete Stripe Connect bank onboarding to receive ACH direct deposit.",
          metadata: { bookingId, workedUnits, bookedUnits },
        });
        try {
          await notifyPayoutMethodNeeded({
            admin,
            refMemberId: booking.ref_member_id,
            amountCents: money.refPayCents,
            eventId: booking.event_id,
            reason: ready.reason ?? "pending_onboarding",
            siteUrl,
          });
        } catch (err) {
          console.error("[settle-booking] payout email failed:", err);
        }
      } else {
        const payoutRow = await upsertPayoutPending(admin, {
          payment_id: payment.id,
          event_id: booking.event_id,
          offer_id: offer.id,
          payee_member_id: booking.ref_member_id,
          stripe_connect_account_id: connect!.stripe_account_id,
          gross_cents: money.refPayCents,
          status: "processing",
          metadata: { bookingId, workedUnits, bookedUnits },
        });
        const fromOriginal = Math.min(money.refPayCents, money.bookedPayCents);
        const extraPart = money.refPayCents - fromOriginal;
        const meta = {
          payment_id: payment.id,
          offer_id: offer.id,
          event_id: booking.event_id,
          payee_member_id: booking.ref_member_id,
          booking_id: bookingId,
        };
        try {
          const originalChargeId = await chargeIdForIntent(
            stripe,
            payment.stripe_payment_intent_id,
          );
          if (fromOriginal > 0) {
            await executeTransfer({
              admin,
              payoutId: payoutRow.id,
              amountCents: fromOriginal,
              destination: connect!.stripe_account_id,
              transferGroup: booking.event_id,
              metadata: meta,
              sourceTransaction: originalChargeId,
              idempotencyKey: `settle-payout-${bookingId}`,
            });
          }
          if (extraPart > 0) {
            const extra = await stripe.transfers.create(
              {
                amount: extraPart,
                currency: "usd",
                destination: connect!.stripe_account_id,
                transfer_group: booking.event_id,
                metadata: { ...meta, part: "extra_work" },
                ...(extraChargeId ? { source_transaction: extraChargeId } : {}),
              },
              { idempotencyKey: `settle-payout-extra-${bookingId}` },
            );
            await admin
              .from("payouts")
              .update({
                ...(fromOriginal > 0 ? {} : { stripe_transfer_id: extra.id }),
                status: "paid",
                paid_at: nowIso,
                metadata: {
                  bookingId,
                  workedUnits,
                  bookedUnits,
                  extraTransferId: extra.id,
                },
                updated_at: nowIso,
              })
              .eq("id", payoutRow.id);
          }
          payoutState = "paid";
          await admin
            .from("assignment_offers")
            .update({ payment_status: "paid" })
            .eq("id", offer.id);
          await admin
            .from("bookings")
            .update({ payment_status: "paid", status: "completed" })
            .eq("id", bookingId);
        } catch (err) {
          payoutState = "failed";
          const message =
            err instanceof Error ? err.message : "Transfer failed.";
          errors.push(`payout: ${message}`);
          await admin
            .from("payouts")
            .update({
              status: "failed",
              failure_reason: message,
              updated_at: nowIso,
            })
            .eq("id", payoutRow.id);
        }
      }
    } else {
      // Nothing worked: no payout; the refund above returned the organizer's money.
      await admin
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", bookingId);
    }
  } catch (err) {
    payoutState = "failed";
    errors.push(
      `payout setup: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await admin
    .from("booking_timesheets")
    .update({
      ref_pay_cents: money.refPayCents,
      organizer_adjust_cents: money.adjustCents,
      adjust_status: adjustStatus,
      adjust_payment_id: adjustPaymentId,
      settle_error: errors.length ? errors.join(" | ").slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", bookingId);

  try {
    if (adjustStatus === "charge_failed") {
      await notifyOrganizerExtraChargeFailed({
        admin,
        organizerMemberId: booking.organizer_member_id,
        eventId: booking.event_id,
        amountCents: money.adjustCents,
        summary,
        siteUrl,
      });
    } else if (adjustStatus === "charged" || adjustStatus === "refunded") {
      await notifyOrganizerTimesheetSettled({
        admin,
        organizerMemberId: booking.organizer_member_id,
        eventId: booking.event_id,
        summary,
        adjustCents: money.adjustCents,
        siteUrl,
      });
    }
  } catch (err) {
    console.error("[settle-booking] organizer email failed:", err);
  }

  return {
    status: "settled",
    refPayCents: money.refPayCents,
    adjustCents: money.adjustCents,
    adjustStatus,
    payout: payoutState,
  };
}

type SweepBooking = {
  id: string;
  event_id: string;
  ref_member_id: string;
  organizer_member_id: string;
  offer_id: string | null;
  status: string;
  payment_status: string | null;
  scheduled_events: { ends_at: string } | { ends_at: string }[] | null;
};

/**
 * Daily catch-up for ended events. Approves what has waited 48 hours, then settles:
 * - REF hasn't signed off 48h after the organizer submitted → approved as submitted.
 * - Organizer checked a REF in but never clocked out, 48h after the event → booked amount.
 * - Organizer never checked the REF in, 48h after the event → booked amount.
 * - Disputed timesheets wait for GotREFS.
 * Returns null when the timesheets table isn't set up yet (caller falls back to the old payout).
 */
export async function runSettlementSweep(
  admin: SupabaseClient,
  now = new Date(),
) {
  const probe = await admin
    .from("booking_timesheets")
    .select("booking_id, settled_at")
    .limit(1);
  if (probe.error) return null;

  const nowMs = now.getTime();
  const since = new Date(nowMs - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "id, event_id, ref_member_id, organizer_member_id, offer_id, status, payment_status, scheduled_events!inner(ends_at)",
    )
    .in("status", ["confirmed", "completed"])
    .lte("scheduled_events.ends_at", now.toISOString())
    .gte("scheduled_events.ends_at", since)
    .limit(300);
  if (error) throw new Error(error.message);
  const bookings = (data as SweepBooking[] | null) ?? [];

  const ids = bookings.map((b) => b.id);
  const sheets = new Map<string, Timesheet>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows } = await admin
      .from("booking_timesheets")
      .select("*")
      .in("booking_id", ids.slice(i, i + 200));
    for (const row of (rows as Timesheet[] | null) ?? [])
      sheets.set(row.booking_id, row);
  }

  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  const iso = now.toISOString();

  for (const b of bookings) {
    const ev = Array.isArray(b.scheduled_events)
      ? b.scheduled_events[0]
      : b.scheduled_events;
    const endedLongAgo = ev
      ? nowMs - new Date(ev.ends_at).getTime() >= AUTO_APPROVE_MS
      : false;
    const sheet = sheets.get(b.id);
    try {
      if (sheet?.settled_at) {
        bump("already_settled");
        continue;
      }
      if (!sheet) {
        if (b.payment_status === "paid" || !endedLongAgo || !b.offer_id) {
          bump(
            b.payment_status === "paid" ? "paid_before_timesheets" : "waiting",
          );
          continue;
        }
        const { data: offer } = await admin
          .from("assignment_offers")
          .select("offered_pay, games_count")
          .eq("id", b.offer_id)
          .maybeSingle();
        const { data: refProfile } = await admin
          .from("ref_profiles")
          .select("rate_unit")
          .eq("member_id", b.ref_member_id)
          .maybeSingle();
        const booked = resolveOfferGamesWorked(offer);
        await admin.from("booking_timesheets").upsert(
          {
            booking_id: b.id,
            event_id: b.event_id,
            ref_member_id: b.ref_member_id,
            organizer_member_id: b.organizer_member_id,
            pay_unit: refProfile?.rate_unit === "hour" ? "hour" : "game",
            rate: offer?.offered_pay ?? null,
            booked_units: booked,
            worked_units: booked,
            status: "approved",
            auto_approved: true,
            submitted_at: iso,
            updated_at: iso,
          },
          { onConflict: "booking_id", ignoreDuplicates: true },
        );
      } else if (sheet.status === "checked_in") {
        if (!endedLongAgo) {
          bump("waiting");
          continue;
        }
        await admin
          .from("booking_timesheets")
          .update({
            status: "approved",
            auto_approved: true,
            worked_units: sheet.booked_units,
            submitted_at: iso,
            updated_at: iso,
          })
          .eq("booking_id", b.id)
          .eq("status", "checked_in");
      } else if (sheet.status === "awaiting_ref") {
        const submitted = sheet.submitted_at
          ? new Date(sheet.submitted_at).getTime()
          : 0;
        if (nowMs - submitted < AUTO_APPROVE_MS) {
          bump("waiting_on_ref");
          continue;
        }
        await admin
          .from("booking_timesheets")
          .update({
            status: "approved",
            auto_approved: true,
            ref_decided_at: iso,
            updated_at: iso,
          })
          .eq("booking_id", b.id)
          .eq("status", "awaiting_ref");
      } else if (sheet.status === "disputed") {
        bump("disputed");
        continue;
      }
      const result = await settleBooking(admin, b.id);
      bump(result.status === "settled" ? "settled" : `skip:${result.reason}`);
    } catch (err) {
      bump("error");
      console.error("[settlement-sweep]", b.id, err);
    }
  }
  return { checked: bookings.length, ...counts };
}
