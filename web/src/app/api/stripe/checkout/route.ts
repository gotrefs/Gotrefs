import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, dollarsToCents } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveSiteUrlFromRequest, serverEnv } from "@/lib/env/server";
import { PLATFORM_FEE_PERCENT_LABEL, platformFeeCents as calcPlatformFeeCents } from "@/lib/platform-fee";

type CheckoutBody = {
  eventId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from("scheduled_events")
    .select("id, title, sport, starts_at, organizer_member_id, pay_offer")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found or not yours." }, { status: 403 });
  }

  const { data: offers, error: offersError } = await supabase
    .from("assignment_offers")
    .select("id, ref_member_id, offered_pay, payment_status")
    .eq("event_id", event.id)
    .eq("status", "accepted");

  if (offersError) {
    return NextResponse.json({ error: offersError.message }, { status: 400 });
  }

  const acceptedOffers = (offers ?? []).filter((offer) => offer.payment_status !== "paid");
  if (acceptedOffers.length === 0) {
    return NextResponse.json(
      { error: "No unpaid accepted refs are ready for checkout yet." },
      { status: 400 }
    );
  }

  const refSubtotalCents = acceptedOffers.reduce(
    (sum, offer) => sum + dollarsToCents(offer.offered_pay ?? event.pay_offer),
    0
  );
  if (refSubtotalCents <= 0) {
    return NextResponse.json(
      { error: "Add a pay offer before creating checkout for this event." },
      { status: 400 }
    );
  }

  const platformFeeCents = calcPlatformFeeCents(refSubtotalCents);
  const origin = resolveSiteUrlFromRequest(request) || serverEnv.siteUrl();
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const eventDate = new Date(event.starts_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const offerIds = acceptedOffers.map((offer) => offer.id);
  const metadata = {
    purpose: "event_refs",
    eventId: event.id,
    organizerMemberId: user.id,
    acceptedOfferIds: offerIds.join(","),
    refCount: String(acceptedOffers.length),
    refSubtotalCents: String(refSubtotalCents),
    platformFeeCents: String(platformFeeCents),
  };

  let paymentId: string | null = null;
  try {
    const admin = createServiceClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        organizer_member_id: user.id,
        event_id: event.id,
        purpose: "event_refs",
        amount_total_cents: refSubtotalCents + platformFeeCents,
        amount_subtotal_cents: refSubtotalCents,
        platform_fee_cents: platformFeeCents,
        status: "pending",
        accepted_offer_ids: offerIds,
        metadata,
      })
      .select("id")
      .single();
    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 });
    }
    paymentId = payment.id;
  } catch {
    // Continue without local ledger row if service role is unavailable; webhook can still insert.
  }

  const sessionParams = {
    mode: "payment" as const,
    payment_method_types: ["card", "us_bank_account"] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: refSubtotalCents,
          product_data: {
            name: `${event.title} referee pay`,
            description: `${acceptedOffers.length} accepted ref${acceptedOffers.length === 1 ? "" : "s"} for ${event.sport} on ${eventDate}`,
          },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: platformFeeCents,
          product_data: {
            name: "GotRefs platform fee",
            description: `${PLATFORM_FEE_PERCENT_LABEL} marketplace service fee`,
          },
        },
      },
    ],
    metadata: {
      ...metadata,
      paymentId: paymentId || "",
    },
    payment_intent_data: {
      metadata: {
        ...metadata,
        paymentId: paymentId || "",
      },
      transfer_group: event.id,
    },
    success_url: `${origin}/dashboard/organizer?checkout=success&event=${event.id}${
      paymentId ? `&payment=${paymentId}&tab=tax` : "&tab=tax"
    }`,
    cancel_url: `${origin}/dashboard/organizer?checkout=cancelled&event=${event.id}`,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    // ACH debit may not be enabled yet on the Stripe account — fall back to card-only.
    const message = err instanceof Error ? err.message : "";
    if (/us_bank_account|payment_method_types/i.test(message)) {
      session = await stripe.checkout.sessions.create({
        ...sessionParams,
        payment_method_types: ["card"],
      });
    } else {
      throw err;
    }
  }

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  if (paymentId) {
    try {
      const admin = createServiceClient();
      await admin
        .from("payments")
        .update({
          stripe_checkout_session_id: session.id,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);
    } catch {
      // Non-fatal.
    }
  }

  return NextResponse.json({ url: session.url, paymentId });
}
