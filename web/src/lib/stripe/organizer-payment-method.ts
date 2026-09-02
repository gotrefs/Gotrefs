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

export async function getOrganizerPaymentProfile(admin: SupabaseClient, memberId: string) {
  const { data, error } = await admin
    .from("organizer_profiles")
    .select(
      "member_id, stripe_customer_id, default_payment_method_id, payment_method_brand, payment_method_last4, payment_method_type, payment_method_updated_at"
    )
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    if (/stripe_customer_id|default_payment_method|payment_method_/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  return (data as OrganizerPaymentMethodRow | null) ?? null;
}

export async function ensureOrganizerStripeCustomer(
  admin: SupabaseClient,
  args: { memberId: string; email?: string | null; name?: string | null }
) {
  const existing = await getOrganizerPaymentProfile(admin, args.memberId);
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: args.email || undefined,
    name: args.name || undefined,
    metadata: { member_id: args.memberId, role: "organizer" },
  });

  const now = new Date().toISOString();
  const { error } = await admin.from("organizer_profiles").upsert(
    {
      member_id: args.memberId,
      stripe_customer_id: customer.id,
      updated_at: now,
    },
    { onConflict: "member_id" }
  );
  if (error) throw new Error(error.message);
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
