import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { requireAal2ForSensitiveAction } from "@/lib/auth/mfa";
import { resolveSiteUrlFromRequest } from "@/lib/env/server";
import { PLATFORM_FEE_PERCENT_LABEL, platformFeeCents as calcPlatformFeeCents } from "@/lib/platform-fee";
import {
  createConnectOnboardingLink,
  ensureExpressConnectAccount,
} from "@/lib/stripe/connect";
import { dollarsToCents, getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("vendors")
    .select("id, display_name, contact_email, member_id, status, created_at")
    .eq("organizer_member_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    action?: "create" | "pay" | "onboard_payee";
    displayName?: string;
    contactEmail?: string;
    vendorId?: string;
    amountDollars?: number;
    description?: string;
    payeeMemberId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const sync = await syncMemberAccount(admin, user);
  if (sync.role !== "organizer") {
    return NextResponse.json({ error: "Only organizers can manage vendor payments." }, { status: 403 });
  }

  if (body.action === "create") {
    const name = (body.displayName ?? "").trim();
    if (!name) return NextResponse.json({ error: "displayName is required." }, { status: 400 });
    const { data, error } = await admin
      .from("vendors")
      .insert({
        organizer_member_id: user.id,
        display_name: name,
        contact_email: body.contactEmail?.trim() || null,
        member_id: body.payeeMemberId || null,
      })
      .select("id, display_name, contact_email, member_id, status, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ vendor: data });
  }

  if (body.action === "onboard_payee") {
    const mfa = await requireAal2ForSensitiveAction(user);
    if (!mfa.ok) {
      return NextResponse.json({ error: mfa.error, code: mfa.code }, { status: 403 });
    }
    if (!body.vendorId || !body.payeeMemberId) {
      return NextResponse.json({ error: "vendorId and payeeMemberId are required." }, { status: 400 });
    }

    const { data: vendor } = await admin
      .from("vendors")
      .select("id")
      .eq("id", body.vendorId)
      .eq("organizer_member_id", user.id)
      .maybeSingle();
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

    const { data: payeeUser } = await admin.auth.admin.getUserById(body.payeeMemberId);
    const account = await ensureExpressConnectAccount(admin, {
      memberId: body.payeeMemberId,
      email: payeeUser.user?.email,
    });
    await admin
      .from("vendors")
      .update({
        member_id: body.payeeMemberId,
        stripe_connect_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.vendorId);

    const origin = resolveSiteUrlFromRequest(request);
    const link = await createConnectOnboardingLink({
      stripeAccountId: account.stripe_account_id,
      returnUrl: `${origin}/dashboard/organizer?vendorConnect=return`,
      refreshUrl: `${origin}/dashboard/organizer?vendorConnect=refresh`,
    });
    return NextResponse.json({ url: link.url, connect: account });
  }

  if (body.action === "pay") {
    if (!body.vendorId) {
      return NextResponse.json({ error: "vendorId is required." }, { status: 400 });
    }
    const amountCents = dollarsToCents(body.amountDollars);
    if (amountCents <= 0) {
      return NextResponse.json({ error: "Enter a valid payment amount." }, { status: 400 });
    }

    const { data: vendor } = await admin
      .from("vendors")
      .select("id, display_name, member_id")
      .eq("id", body.vendorId)
      .eq("organizer_member_id", user.id)
      .maybeSingle();
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });

    const fee = calcPlatformFeeCents(amountCents);
    const origin = resolveSiteUrlFromRequest(request);
    const stripe = getStripe();
    const description = (body.description ?? "").trim() || `Payment to ${vendor.display_name}`;

    const metadata = {
      purpose: "vendor",
      vendorId: vendor.id,
      organizerMemberId: user.id,
      vendorSubtotalCents: String(amountCents),
      platformFeeCents: String(fee),
    };

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        organizer_member_id: user.id,
        vendor_id: vendor.id,
        purpose: "vendor",
        amount_total_cents: amountCents + fee,
        amount_subtotal_cents: amountCents,
        platform_fee_cents: fee,
        status: "pending",
        metadata,
      })
      .select("id")
      .single();
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "us_bank_account"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Vendor payment · ${vendor.display_name}`,
              description,
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: fee,
            product_data: {
              name: "GotRefs platform fee",
              description: `${PLATFORM_FEE_PERCENT_LABEL} marketplace service fee`,
            },
          },
        },
      ],
      metadata: { ...metadata, paymentId: payment.id },
      payment_intent_data: {
        metadata: { ...metadata, paymentId: payment.id },
        transfer_group: `vendor_${vendor.id}`,
      },
      success_url: `${origin}/dashboard/organizer?vendorPay=success&vendor=${vendor.id}&payment=${payment.id}&tab=tax`,
      cancel_url: `${origin}/dashboard/organizer?vendorPay=cancelled&vendor=${vendor.id}`,
    }).catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      if (!/us_bank_account|payment_method_types/i.test(message)) throw err;
      return stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `Vendor payment · ${vendor.display_name}`,
                description,
              },
            },
          },
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: fee,
              product_data: {
                name: "GotRefs platform fee",
                description: `${PLATFORM_FEE_PERCENT_LABEL} marketplace service fee`,
              },
            },
          },
        ],
        metadata: { ...metadata, paymentId: payment.id },
        payment_intent_data: {
          metadata: { ...metadata, paymentId: payment.id },
          transfer_group: `vendor_${vendor.id}`,
        },
        success_url: `${origin}/dashboard/organizer?vendorPay=success&vendor=${vendor.id}&payment=${payment.id}&tab=tax`,
        cancel_url: `${origin}/dashboard/organizer?vendorPay=cancelled&vendor=${vendor.id}`,
      });
    });

    await admin
      .from("payments")
      .update({
        stripe_checkout_session_id: session.id,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url, paymentId: payment.id });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
