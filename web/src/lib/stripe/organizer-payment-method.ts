import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";

export type OrganizerPaymentMethodRow = {
  member_id: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  payment_method_type: string | null;
  payment_method_updated_at: string | null;
};

let paymentColumnsReady: boolean | null = null;

async function organizerPaymentColumnsReady(admin: SupabaseClient): Promise<boolean> {
  if (paymentColumnsReady !== null) return paymentColumnsReady;
  const { error } = await admin.from("organizer_profiles").select("stripe_customer_id").limit(1);
  paymentColumnsReady = !(
    error && /stripe_customer_id|default_payment_method|payment_method_/i.test(error.message)
  );
  return paymentColumnsReady;
}

async function findStripeCustomerForMember(memberId: string, email?: string | null) {
  const stripe = getStripe();
  try {
    const found = await stripe.customers.search({
      query: `metadata['member_id']:'${memberId}'`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0];
  } catch {
    // Search may be unavailable; fall through to email lookup.
  }
  if (email) {
    const listed = await stripe.customers.list({ email, limit: 10 });
    const match = listed.data.find((c) => c.metadata?.member_id === memberId) ?? listed.data[0];
    if (match) return match;
  }
  return null;
}

async function profileFromStripeCustomer(
  memberId: string,
  customer: Stripe.Customer
): Promise<OrganizerPaymentMethodRow> {
  const defaultPm =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id ?? null;

  let brand: string | null = null;
  let last4: string | null = null;
  let type: string | null = null;

  if (defaultPm) {
    try {
      const pm = await getStripe().paymentMethods.retrieve(defaultPm);
      const display = paymentMethodDisplayFields(pm);
      brand = display.payment_method_brand;
      last4 = display.payment_method_last4;
      type = display.payment_method_type;
    } catch {
      // Keep ids even if display lookup fails.
    }
  }

  return {
    member_id: memberId,
    stripe_customer_id: customer.id,
    default_payment_method_id: defaultPm,
    payment_method_brand: brand,
    payment_method_last4: last4,
    payment_method_type: type,
    payment_method_updated_at: null,
  };
}

export async function getOrganizerPaymentProfile(admin: SupabaseClient, memberId: string) {
  if (await organizerPaymentColumnsReady(admin)) {
    const { data, error } = await admin
      .from("organizer_profiles")
      .select(
        "member_id, stripe_customer_id, default_payment_method_id, payment_method_brand, payment_method_last4, payment_method_type, payment_method_updated_at"
      )
      .eq("member_id", memberId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = (data as OrganizerPaymentMethodRow | null) ?? null;
    if (row?.stripe_customer_id && row.default_payment_method_id) return row;
    if (row?.stripe_customer_id) return row;
  }

  const customer = await findStripeCustomerForMember(memberId);
  if (!customer) return null;
  return profileFromStripeCustomer(memberId, customer);
}

export async function ensureOrganizerStripeCustomer(
  admin: SupabaseClient,
  args: { memberId: string; email?: string | null; name?: string | null }
) {
  const existing = await getOrganizerPaymentProfile(admin, args.memberId);
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const fromStripe = await findStripeCustomerForMember(args.memberId, args.email);
  if (fromStripe) {
    if (await organizerPaymentColumnsReady(admin)) {
      await admin
        .from("organizer_profiles")
        .upsert(
          {
            member_id: args.memberId,
            stripe_customer_id: fromStripe.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
    }
    return fromStripe.id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: args.email || undefined,
    name: args.name || undefined,
    metadata: { member_id: args.memberId, role: "organizer" },
  });

  if (await organizerPaymentColumnsReady(admin)) {
    const { error } = await admin.from("organizer_profiles").upsert(
      {
        member_id: args.memberId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );
    if (error) throw new Error(error.message);
  }

  return customer.id;
}

export function paymentMethodDisplayFields(pm: Stripe.PaymentMethod) {
  if (pm.type === "card" && pm.card) {
    return {
      payment_method_type: "card",
      payment_method_brand: pm.card.brand || "card",
      payment_method_last4: pm.card.last4 || null,
    };
  }
  if (pm.type === "us_bank_account" && pm.us_bank_account) {
    return {
      payment_method_type: "us_bank_account",
      payment_method_brand: pm.us_bank_account.bank_name || "bank",
      payment_method_last4: pm.us_bank_account.last4 || null,
    };
  }
  return {
    payment_method_type: pm.type || "unknown",
    payment_method_brand: pm.type || "payment method",
    payment_method_last4: null as string | null,
  };
}

export async function saveOrganizerDefaultPaymentMethod(
  admin: SupabaseClient,
  args: {
    memberId: string;
    customerId: string;
    paymentMethodId: string;
  }
) {
  const stripe = getStripe();
  const pm = await stripe.paymentMethods.retrieve(args.paymentMethodId);
  const display = paymentMethodDisplayFields(pm);

  await stripe.customers.update(args.customerId, {
    invoice_settings: { default_payment_method: args.paymentMethodId },
  });

  if (await organizerPaymentColumnsReady(admin)) {
    const now = new Date().toISOString();
    const { error } = await admin
      .from("organizer_profiles")
      .update({
        stripe_customer_id: args.customerId,
        default_payment_method_id: args.paymentMethodId,
        ...display,
        payment_method_updated_at: now,
        updated_at: now,
      })
      .eq("member_id", args.memberId);

    if (error) throw new Error(error.message);
  }

  return display;
}

export async function createOrganizerSetupIntent(
  admin: SupabaseClient,
  args: { memberId: string; email?: string | null; name?: string | null }
) {
  const customerId = await ensureOrganizerStripeCustomer(admin, args);
  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card", "us_bank_account"],
    usage: "off_session",
    metadata: { member_id: args.memberId, purpose: "organizer_default_pm" },
  });
  return { customerId, setupIntent };
}

/** Hosted Stripe Checkout (setup mode) — same redirect pattern as Connect for refs. */
export async function createOrganizerCheckoutSetupSession(
  admin: SupabaseClient,
  args: {
    memberId: string;
    email?: string | null;
    name?: string | null;
    successUrl: string;
    cancelUrl: string;
  }
) {
  const customerId = await ensureOrganizerStripeCustomer(admin, {
    memberId: args.memberId,
    email: args.email,
    name: args.name,
  });
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    currency: "usd",
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: { member_id: args.memberId, purpose: "organizer_default_pm" },
    setup_intent_data: {
      metadata: { member_id: args.memberId, purpose: "organizer_default_pm" },
    },
  });
  return { customerId, session };
}

export async function confirmOrganizerCheckoutSession(
  admin: SupabaseClient,
  args: { memberId: string; sessionId: string }
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(args.sessionId, {
    expand: ["setup_intent", "customer"],
  });
  if (session.metadata?.member_id && session.metadata.member_id !== args.memberId) {
    throw new Error("Checkout session does not belong to this organizer.");
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const setupIntent =
    typeof session.setup_intent === "string"
      ? await stripe.setupIntents.retrieve(session.setup_intent)
      : session.setup_intent;
  const paymentMethodId =
    typeof setupIntent?.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id ?? null;

  if (!customerId || !paymentMethodId) {
    throw new Error("Stripe Checkout did not return a payment method yet.");
  }

  const display = await saveOrganizerDefaultPaymentMethod(admin, {
    memberId: args.memberId,
    customerId,
    paymentMethodId,
  });
  return display;
}
