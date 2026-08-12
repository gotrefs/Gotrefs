import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe, taxYearForDate } from "@/lib/stripe/client";

export type ConnectAccountRow = {
  id: string;
  member_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  tax_id_provided: boolean;
  onboarding_complete: boolean;
  requirements_due: unknown;
};

function taxIdProvidedFromAccount(account: Stripe.Account): boolean {
  if (account.individual && "tax_id_provided" in account.individual) {
    return Boolean((account.individual as { tax_id_provided?: boolean }).tax_id_provided);
  }
  if (account.company && "tax_id_provided" in account.company) {
    return Boolean((account.company as { tax_id_provided?: boolean }).tax_id_provided);
  }
  return false;
}

export function syncFieldsFromStripeAccount(account: Stripe.Account) {
  const due = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
  ];
  const taxIdProvided = taxIdProvidedFromAccount(account);
  const onboardingComplete =
    Boolean(account.details_submitted) &&
    Boolean(account.payouts_enabled) &&
    due.length === 0;

  return {
    charges_enabled: Boolean(account.charges_enabled),
    payouts_enabled: Boolean(account.payouts_enabled),
    details_submitted: Boolean(account.details_submitted),
    tax_id_provided: taxIdProvided,
    onboarding_complete: onboardingComplete,
    requirements_due: due,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertConnectAccountFromStripe(
  admin: SupabaseClient,
  memberId: string,
  account: Stripe.Account
) {
  const fields = syncFieldsFromStripeAccount(account);
  const { data, error } = await admin
    .from("stripe_connect_accounts")
    .upsert(
      {
        member_id: memberId,
        stripe_account_id: account.id,
        account_type: "express",
        ...fields,
      },
      { onConflict: "member_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ConnectAccountRow;
}

export async function ensureExpressConnectAccount(
  admin: SupabaseClient,
  args: { memberId: string; email?: string | null }
) {
  const stripe = getStripe();
  const { data: existing } = await admin
    .from("stripe_connect_accounts")
    .select("*")
    .eq("member_id", args.memberId)
    .maybeSingle();

  if (existing?.stripe_account_id) {
    const account = await stripe.accounts.retrieve(existing.stripe_account_id);
    return upsertConnectAccountFromStripe(admin, args.memberId, account);
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: args.email || undefined,
    business_type: "individual",
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      member_id: args.memberId,
    },
    settings: {
      payouts: {
        schedule: { interval: "daily" },
      },
    },
  });

  return upsertConnectAccountFromStripe(admin, args.memberId, account);
}

export async function createConnectOnboardingLink(args: {
  stripeAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: args.stripeAccountId,
    refresh_url: args.refreshUrl,
    return_url: args.returnUrl,
    type: "account_onboarding",
  });
}

export async function createConnectLoginLink(stripeAccountId: string) {
  const stripe = getStripe();
  return stripe.accounts.createLoginLink(stripeAccountId);
}

/** Require tax ID before any payout (stricter IRS-aligned default from the plan). */
export function connectReadyForPayout(row: ConnectAccountRow | null | undefined): {
  ok: boolean;
  reason?: "missing_account" | "pending_onboarding" | "pending_tax";
} {
  if (!row?.stripe_account_id) return { ok: false, reason: "missing_account" };
  if (!row.payouts_enabled || !row.onboarding_complete) {
    return { ok: false, reason: "pending_onboarding" };
  }
  if (!row.tax_id_provided) return { ok: false, reason: "pending_tax" };
  return { ok: true };
}
