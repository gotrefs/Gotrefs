import { NextResponse } from "next/server";
import { resolveSiteUrlFromRequest } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  confirmOrganizerCheckoutSession,
  createOrganizerCheckoutSetupSession,
  getOrganizerPaymentProfile,
  saveOrganizerDefaultPaymentMethod,
} from "@/lib/stripe/organizer-payment-method";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: member } = await admin.from("members").select("role").eq("id", user.id).maybeSingle();
  if (member?.role !== "organizer") {
    return NextResponse.json({ error: "Organizer account required." }, { status: 403 });
  }

  try {
    const profile = await getOrganizerPaymentProfile(admin, user.id);
    return NextResponse.json({
      ready: Boolean(profile?.stripe_customer_id && profile?.default_payment_method_id),
      paymentMethod: profile?.default_payment_method_id
        ? {
            brand: profile.payment_method_brand,
            last4: profile.payment_method_last4,
            type: profile.payment_method_type,
            updatedAt: profile.payment_method_updated_at,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    setupIntentId?: string;
    paymentMethodId?: string;
    sessionId?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: member } = await admin
    .from("members")
    .select("role, display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (member?.role !== "organizer") {
    return NextResponse.json({ error: "Organizer account required." }, { status: 403 });
  }

  const action = body.action || "create_checkout_setup";
  const origin = resolveSiteUrlFromRequest(request);

  try {
    if (action === "create_checkout_setup" || action === "onboard") {
      const { session } = await createOrganizerCheckoutSetupSession(admin, {
        memberId: user.id,
        email: member.email || user.email,
        name: member.display_name,
        successUrl: `${origin}/dashboard/organizer?tab=payments&pm=return&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/dashboard/organizer?tab=payments&pm=cancel`,
      });
      if (!session.url) {
        return NextResponse.json({ error: "Stripe did not return a Checkout URL." }, { status: 502 });
      }
      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    if (action === "confirm_checkout_session") {
      const sessionId = (body.sessionId || "").trim();
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      }
      const display = await confirmOrganizerCheckoutSession(admin, {
        memberId: user.id,
        sessionId,
      });
      return NextResponse.json({
        ok: true,
        paymentMethod: {
          brand: display.payment_method_brand,
          last4: display.payment_method_last4,
          type: display.payment_method_type,
        },
      });
    }

    if (action === "confirm_saved") {
      const paymentMethodId = (body.paymentMethodId || "").trim();
      if (!paymentMethodId) {
        return NextResponse.json({ error: "paymentMethodId is required." }, { status: 400 });
      }
      const profile = await getOrganizerPaymentProfile(admin, user.id);
      if (!profile?.stripe_customer_id) {
        return NextResponse.json({ error: "No Stripe customer on file yet." }, { status: 400 });
      }
      const display = await saveOrganizerDefaultPaymentMethod(admin, {
        memberId: user.id,
        customerId: profile.stripe_customer_id,
        paymentMethodId,
      });
      return NextResponse.json({
        ok: true,
        paymentMethod: {
          brand: display.payment_method_brand,
          last4: display.payment_method_last4,
          type: display.payment_method_type,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
