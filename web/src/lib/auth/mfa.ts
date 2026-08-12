import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";

export type AalLevel = "aal1" | "aal2";

export async function getAuthenticatorAssuranceLevel(): Promise<{
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    return { currentLevel: null, nextLevel: null };
  }
  return {
    currentLevel: (data.currentLevel as AalLevel | null) ?? null,
    nextLevel: (data.nextLevel as AalLevel | null) ?? null,
  };
}

function allowStripeConnectWithoutMfa(): boolean {
  if (!serverEnv.stripeAllowConnectWithoutMfa()) return false;
  const key = serverEnv.stripeSecretKey() || process.env.STRIPE_SECRET_KEY?.trim() || "";
  return key.startsWith("sk_test_");
}

/** True when the session is at AAL2 (MFA verified) or MFA is not enrolled yet and we only require AAL2 when enrolled. */
export async function requireAal2ForSensitiveAction(user: User | null): Promise<
  | { ok: true }
  | { ok: false; error: string; code: "unauthorized" | "mfa_required" | "mfa_enroll_required" }
> {
  if (!user) {
    return { ok: false, error: "Unauthorized", code: "unauthorized" };
  }

  // Local Stripe test mode: skip 2FA gate so Connect onboarding can be exercised with sk_test_ keys.
  if (allowStripeConnectWithoutMfa()) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");

  const aal = await getAuthenticatorAssuranceLevel();

  if (!hasVerifiedTotp) {
    return {
      ok: false,
      error: "Enable two-factor authentication before connecting a bank account or managing tax payout settings.",
      code: "mfa_enroll_required",
    };
  }

  if (aal.currentLevel !== "aal2") {
    return {
      ok: false,
      error: "Confirm your two-factor code to continue with this payout action.",
      code: "mfa_required",
    };
  }

  return { ok: true };
}
