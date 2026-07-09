import { dashboardPathForSignupRole, type MemberRole } from "@/lib/member-role";

export const SIGNUP_DASHBOARD_PATHS = [
  "/dashboard/referee",
  "/dashboard/organizer",
  "/dashboard/assignor",
] as const;

export type SignupDashboardPath = (typeof SIGNUP_DASHBOARD_PATHS)[number];

export function skipEmailConfirmation(): boolean {
  return process.env.AUTH_SKIP_EMAIL_CONFIRMATION === "true";
}

export function safeSignupRedirectPath(next: string | null | undefined): SignupDashboardPath {
  if (next && SIGNUP_DASHBOARD_PATHS.includes(next as SignupDashboardPath)) {
    return next as SignupDashboardPath;
  }
  return "/dashboard/referee";
}

export function buildAuthCallbackUrl(siteUrl: string, nextPath: string): string {
  const next = encodeURIComponent(nextPath);
  return `${siteUrl.replace(/\/$/, "")}/auth/callback?next=${next}`;
}

export function buildEmailConfirmationRedirectUrl(
  siteUrl: string,
  postVerifyPath: SignupDashboardPath
): string {
  return buildAuthCallbackUrl(siteUrl, postVerifyPath);
}

export function signupDashboardPath(
  role: MemberRole,
  isAssignor: boolean
): SignupDashboardPath {
  return safeSignupRedirectPath(dashboardPathForSignupRole(role, isAssignor));
}

export function signupDashboardLabel(path: SignupDashboardPath): string {
  if (path === "/dashboard/organizer") return "organizer";
  if (path === "/dashboard/assignor") return "assignor";
  return "referee";
}

/** When email templates use next=/dashboard, resolve the role-specific destination from signup metadata. */
export function resolveEmailCallbackRedirect(
  user: { user_metadata?: Record<string, unknown> | null },
  next: string
): string {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (safeNext !== "/dashboard") {
    return safeSignupRedirectPath(safeNext);
  }
  const meta = user.user_metadata ?? {};
  const role = meta.role === "organizer" ? "organizer" : "ref";
  const isAssignor = meta.is_assignor === true;
  return signupDashboardPath(role, isAssignor);
}
