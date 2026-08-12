import { NextResponse } from "next/server";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe/client";
import { handleStripeWebhookEvent } from "@/lib/stripe/webhooks";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Stripe webhook endpoint. Configure in Stripe Dashboard:
 * https://dashboard.stripe.com/webhooks
 *
 * Events: checkout.session.completed, account.updated, transfer.*, payout.*, payment_intent.succeeded
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = stripeWebhookSecret();

  let event;
  try {
    const stripe = getStripe();
    if (secret) {
      if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
      }
      event = stripe.webhooks.constructEvent(raw, signature, secret);
    } else {
      // Local/dev fallback when webhook secret is not configured.
      event = JSON.parse(raw);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const result = await handleStripeWebhookEvent(admin, event);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error("[webhooks/stripe]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
