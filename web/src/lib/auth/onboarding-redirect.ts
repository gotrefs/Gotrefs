import { gotrefsAdminDashboardPath, isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { dashboardPathForRole, type MemberRole } from "@/lib/member-role";

export type MemberOnboardingState = {
  is_onboarded?: boolean | null;
  role?: string | null;
};

export function onboardingSignupPath(next?: string | null) {
  const params = new URLSearchParams({ oauth: "1", step: "role" });
  if (next && next.startsWith("/") && next !== "/dashboard") {
    params.set("next", next);
  }
  return `/auth/signup?${params.toString()}`;
}

export function memberNeedsOnboarding(member: MemberOnboardingState | null | undefined) {
  return Boolean(member && member.is_onboarded === false);
}

export function resolveAuthenticatedHomePath(options: {
  member: MemberOnboardingState | null | undefined;
  email?: string | null;
  next?: string | null;
}): string {
  const { member, email, next } = options;

  if (isGotrefsAdminUser({ email: email ?? undefined })) {
    return gotrefsAdminDashboardPath();
  }

  if (memberNeedsOnboarding(member)) {
    return onboardingSignupPath(next);
  }

  const role: MemberRole =
    member?.role === "organizer" ? "organizer" : "ref";
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  if (safeNext && safeNext !== "/dashboard") {
    return safeNext;
  }

  return dashboardPathForRole(role);
}
