import type { SupabaseClient } from "@supabase/supabase-js";
import { findUserByEmail } from "@/lib/auth/admin-users";

/**
 * Reserved signup identity for repeatedly testing referee / organizer onboarding.
 * Registering with this email deletes any previous auth user for it first, so you
 * never hit "That email already has a GotRefs account."
 */
export const ONBOARDING_TEST_EMAIL = "onboarding.tester@gotrefs.org";

/** Suggested password for the reusable onboarding tester (meets strength rules). */
export const ONBOARDING_TEST_PASSWORD = "GotRefsTest1";

export function isReusableOnboardingTestEmail(email: string): boolean {
  return email.trim().toLowerCase() === ONBOARDING_TEST_EMAIL;
}

/**
 * Wipe any existing auth user for the reusable onboarding tester.
 * members / ref_profiles cascade from auth.users.
 */
export async function resetReusableOnboardingTestAccount(
  admin: SupabaseClient,
  email: string
): Promise<{ wiped: boolean; error?: string }> {
  if (!isReusableOnboardingTestEmail(email)) {
    return { wiped: false };
  }

  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    return { wiped: false };
  }

  const { error } = await admin.auth.admin.deleteUser(existing.id);
  if (error) {
    console.error("[onboarding-test-account] deleteUser:", error.message);
    return { wiped: false, error: error.message };
  }

  return { wiped: true };
}
