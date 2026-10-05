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
export const dynamic = "force-dynamic";

/**
 * Configuration self-check (no secrets are returned — only whether each one is
 * present and shaped like a real Stripe value). Open this URL in a browser to
 * see why webhook deliveries might be rejected.
 */
export async function GET() {
  const secrets = stripeWebhookSecrets();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const stripeKey = key.startsWith("sk_live_")
    ? "live"
    : key.startsWith("sk_test_")
      ? "test"
      : key.startsWith("rk_live_")
        ? "restricted-live"
        : key.startsWith("rk_test_")
          ? "restricted-test"
          : key
            ? "unrecognized"
            : "missing";
  const raw = {
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "",
  };
  const describe = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "missing";
    const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
    const allValid = parts.every((part) => /^whsec_[A-Za-z0-9]{16,}$/.test(part));
    return allValid ? "looks valid" : "set, but not a valid whsec_ secret";
  };
  return NextResponse.json(
    {
      endpoint: "stripe-webhook",
      acceptedSecrets: secrets.length,
      STRIPE_WEBHOOK_SECRET: describe(raw.STRIPE_WEBHOOK_SECRET),
      STRIPE_CONNECT_WEBHOOK_SECRET: describe(raw.STRIPE_CONNECT_WEBHOOK_SECRET),
      stripeSecretKey: stripeKey,
      supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "set" : "missing",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

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
