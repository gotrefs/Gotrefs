import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";
import { PLATFORM_FEE_PERCENT_LABEL, platformFeeCents as calcPlatformFeeCents } from "@/lib/platform-fee";

type CheckoutBody = {
  eventId?: string;
};

function dollarsToCents(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

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
    .select("id, ref_member_id, offered_pay")
    .eq("event_id", event.id)
    .eq("status", "accepted");

  if (offersError) {
    return NextResponse.json({ error: offersError.message }, { status: 400 });
  }

  const acceptedOffers = offers ?? [];
  if (acceptedOffers.length === 0) {
    return NextResponse.json({ error: "No accepted refs are ready for checkout yet." }, { status: 400 });
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
  const origin = serverEnv.siteUrl() || new URL(request.url).origin;
  const stripe = getStripe();
  const eventDate = new Date(event.starts_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
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
            name: "GotREFS platform fee",
            description: `${PLATFORM_FEE_PERCENT_LABEL} marketplace service fee`,
          },
        },
      },
    ],
    metadata: {
      eventId: event.id,
      organizerMemberId: user.id,
      acceptedOfferIds: acceptedOffers.map((offer) => offer.id).join(","),
      refCount: String(acceptedOffers.length),
      refSubtotalCents: String(refSubtotalCents),
      platformFeeCents: String(platformFeeCents),
    },
    payment_intent_data: {
      metadata: {
        eventId: event.id,
        organizerMemberId: user.id,
        acceptedOfferIds: acceptedOffers.map((offer) => offer.id).join(","),
      },
    },
    success_url: `${origin}/dashboard/organizer?checkout=success&event=${event.id}`,
    cancel_url: `${origin}/dashboard/organizer?checkout=cancelled&event=${event.id}`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
