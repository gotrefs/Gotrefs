import { gotrefsAdminDashboardPath, isGotrefsAdminEmail } from "@/lib/auth/admin-access";
import { dashboardPathForRole } from "@/lib/member-role";

export type OAuthMemberRedirect = {
  isOnboarded: boolean;
  role: string | null;
};

export function resolvePostOAuthRedirect(
  origin: string,
  member: OAuthMemberRedirect,
  next: string,
  email?: string | null
): URL {
  if (isGotrefsAdminEmail(email)) {
    return new URL(gotrefsAdminDashboardPath(), origin);
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const role = member.role === "organizer" || member.role === "ref" ? member.role : null;

  if (member.isOnboarded && role) {
    const path = safeNext !== "/dashboard" ? safeNext : dashboardPathForRole(role);
    return new URL(path, origin);
  }

  const url = new URL("/auth/signup", origin);
  url.searchParams.set("oauth", "1");
  url.searchParams.set("step", "role");
  if (safeNext !== "/dashboard") {
    url.searchParams.set("next", safeNext);
  }
  return url;
}
