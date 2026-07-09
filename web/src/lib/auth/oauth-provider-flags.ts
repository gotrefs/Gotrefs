import type { OAuthProvider } from "@/lib/auth/oauth-providers";

function readPublicFlag(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return value === "1" || value.toLowerCase() === "true";
}

/** Which OAuth providers are turned on for this deployment. */
export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  switch (provider) {
    case "google":
      return readPublicFlag("NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED", false);
    case "apple":
      return readPublicFlag("NEXT_PUBLIC_OAUTH_APPLE_ENABLED", false);
    case "facebook":
      return readPublicFlag("NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED", false);
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
