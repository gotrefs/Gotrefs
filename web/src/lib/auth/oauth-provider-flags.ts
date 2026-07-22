import type { OAuthProvider } from "@/lib/auth/oauth-providers";

/**
 * Next.js only inlines NEXT_PUBLIC_* with static access — never process.env[name].
 */
function flag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value === "1" || value.toLowerCase() === "true";
}

/** Which OAuth providers are turned on for this deployment. */
export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  switch (provider) {
    case "google":
      return flag(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED, false);
    case "apple":
      return flag(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED, false);
    case "facebook":
      return flag(process.env.NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED, false);
  }
}

export function enabledOAuthProviders(): OAuthProvider[] {
  return (["google", "apple", "facebook"] as const).filter(isOAuthProviderEnabled);
}

export function oauthProviderDisabledMessage(provider: OAuthProvider): string {
  if (provider === "apple") {
    return "Apple sign-in is not enabled yet. Enable the Apple provider in Supabase Authentication → Providers.";
  }
  if (provider === "facebook") {
    return "Facebook sign-in is not enabled yet. Enable the Facebook provider in Supabase Authentication → Providers.";
  }
  return "This sign-in provider is not enabled.";
}
