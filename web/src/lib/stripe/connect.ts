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

/** Recipient + Express for Separate Charges & Transfers (Accounts v2 create). */
export async function ensureExpressConnectAccount(
  admin: SupabaseClient,
  args: { memberId: string; email?: string | null; displayName?: string | null }
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

  const created = await stripe.v2.core.accounts.create({
    contact_email: args.email || undefined,
    display_name: args.displayName?.trim() || args.email || "GotREFS referee",
    dashboard: "express",
    identity: {
      country: "us",
      entity_type: "individual",
    },
    defaults: {
      currency: "usd",
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: {
      member_id: args.memberId,
    },
    include: ["configuration.recipient", "identity", "requirements"],
  });

  const account = await stripe.accounts.retrieve(created.id);
  return upsertConnectAccountFromStripe(admin, args.memberId, account);
}

export async function createConnectOnboardingLink(args: {
  stripeAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  const stripe = getStripe();
  try {
    return await stripe.v2.core.accountLinks.create({
      account: args.stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          return_url: args.returnUrl,
          refresh_url: args.refreshUrl,
        },
      },
    });
  } catch (v2Err) {
    try {
      return await stripe.accountLinks.create({
        account: args.stripeAccountId,
        refresh_url: args.refreshUrl,
        return_url: args.returnUrl,
        type: "account_onboarding",
      });
    } catch {
      throw v2Err;
    }
  }
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
