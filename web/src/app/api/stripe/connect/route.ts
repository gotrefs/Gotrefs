import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { resolveSiteUrlFromRequest } from "@/lib/env/server";
import { getStripe } from "@/lib/stripe/client";
import {
  createConnectLoginLink,
  createConnectOnboardingLink,
  ensureExpressConnectAccount,
  upsertConnectAccountFromStripe,
} from "@/lib/stripe/connect";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function stripeConnectMfaRequired(): boolean {
  // Payout Connect opens on Stripe’s site; GotREFS no longer gates this behind 2FA.
  return false;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let data:
    | {
        stripe_account_id: string;
        charges_enabled: boolean;
        payouts_enabled: boolean;
        details_submitted: boolean;
        tax_id_provided: boolean;
        onboarding_complete: boolean;
        requirements_due: unknown;
        updated_at?: string;
      }
    | null = (
    await supabase
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, tax_id_provided, onboarding_complete, requirements_due, updated_at"
      )
      .eq("member_id", user.id)
      .maybeSingle()
  ).data;

  // After Express onboarding return, refresh from Stripe so the UI isn't stuck on stale status.
  if (data?.stripe_account_id) {
    try {
      const admin = createServiceClient();
      const account = await getStripe().accounts.retrieve(data.stripe_account_id);
      const synced = await upsertConnectAccountFromStripe(admin, user.id, account);
      data = {
        stripe_account_id: synced.stripe_account_id,
        charges_enabled: synced.charges_enabled,
        payouts_enabled: synced.payouts_enabled,
        details_submitted: synced.details_submitted,
        tax_id_provided: synced.tax_id_provided,
        onboarding_complete: synced.onboarding_complete,
        requirements_due: synced.requirements_due,
      };
    } catch {
      // Keep cached row if Stripe is temporarily unreachable.
    }
  }

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, gross_cents, status, tax_year, paid_at, failure_reason, created_at")
    .eq("payee_member_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    connect: data,
    payouts: payouts ?? [],
    mfaRequired: stripeConnectMfaRequired(),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: "onboard" | "login" } = {};
  try {
    body = (await request.json()) as { action?: "onboard" | "login" };
  } catch {
    body = {};
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  await syncMemberAccount(admin, user);
  const origin = resolveSiteUrlFromRequest(request);

  try {
    const account = await ensureExpressConnectAccount(admin, {
      memberId: user.id,
      email: user.email,
    });

    const connectSummary = {
      stripe_account_id: account.stripe_account_id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      tax_id_provided: account.tax_id_provided,
      onboarding_complete: account.onboarding_complete,
      requirements_due: account.requirements_due,
    };

    if (body.action === "login") {
      // Express login links only work after Stripe onboarding is complete.
      if (!account.details_submitted) {
        const link = await createConnectOnboardingLink({
          stripeAccountId: account.stripe_account_id,
          returnUrl: `${origin}/dashboard/referee?connect=return`,
          refreshUrl: `${origin}/dashboard/referee?connect=refresh`,
        });
        return NextResponse.json({
          url: link.url,
          connect: connectSummary,
          note: "Finish Stripe onboarding first, then you can open the Express dashboard.",
        });
      }

      try {
        const login = await createConnectLoginLink(account.stripe_account_id);
        return NextResponse.json({ url: login.url, connect: connectSummary });
      } catch (loginErr) {
        const loginMessage =
          loginErr instanceof Error ? loginErr.message : "Could not open Stripe Express dashboard.";
        // Fall back to onboarding/update link when login isn't available yet.
        const link = await createConnectOnboardingLink({
          stripeAccountId: account.stripe_account_id,
          returnUrl: `${origin}/dashboard/referee?connect=return`,
          refreshUrl: `${origin}/dashboard/referee?connect=refresh`,
        });
        return NextResponse.json({
          url: link.url,
          connect: connectSummary,
          note: loginMessage,
        });
      }
    }

    const link = await createConnectOnboardingLink({
      stripeAccountId: account.stripe_account_id,
      returnUrl: `${origin}/dashboard/referee?connect=return`,
      refreshUrl: `${origin}/dashboard/referee?connect=refresh`,
    });

    return NextResponse.json({ url: link.url, connect: connectSummary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start Stripe Connect onboarding.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
