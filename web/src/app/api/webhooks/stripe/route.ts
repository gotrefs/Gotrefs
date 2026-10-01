import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeWebhookSecrets } from "@/lib/stripe/client";
import { handleStripeWebhookEvent } from "@/lib/stripe/webhooks";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Stripe webhook endpoint. Configure in Stripe Dashboard → Developers → Webhooks.
 * Two destinations point here, each with its own signing secret:
 *   - "Your account" events (checkout, payments, transfers) → STRIPE_WEBHOOK_SECRET
 *   - "Connected accounts" events (account.updated)         → STRIPE_CONNECT_WEBHOOK_SECRET
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secrets = stripeWebhookSecrets();

  let event: Stripe.Event;
  if (secrets.length === 0) {
    if (process.env.NODE_ENV === "production") {
      // Never trust unsigned events in production — anyone could fake a payment.
      console.error("[webhooks/stripe] No webhook signing secret configured.");
      return NextResponse.json({ error: "Webhook signing secret not configured." }, { status: 500 });
    }
    // Local development only.
    try {
      event = JSON.parse(raw) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
  } else {
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
    }
    const stripe = getStripe();
    let verified: Stripe.Event | null = null;
    for (const secret of secrets) {
      try {
        verified = stripe.webhooks.constructEvent(raw, signature, secret);
        break;
      } catch {
        // Try the next configured secret.
      }
    }
    if (!verified) {
      console.error(
        `[webhooks/stripe] Signature did not match any of ${secrets.length} configured secret(s).`
      );
      return NextResponse.json(
        { error: "No signatures found matching the expected signature for payload." },
        { status: 400 }
      );
    }
    event = verified;
  }

  try {
    const admin = createServiceClient();
    const result = await handleStripeWebhookEvent(admin, event);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed.";
    console.error("[webhooks/stripe]", event.type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
