export type OAuthProvider = "google" | "facebook" | "apple";

export function parseOAuthProvider(value: string): OAuthProvider {
  if (value === "google" || value === "facebook" || value === "apple") return value;
  throw new Error("Unsupported OAuth provider.");
}

export function oauthScopes(provider: OAuthProvider) {
  if (provider === "apple") return "name email";
  if (provider === "facebook") return "email,public_profile";
  return "openid email profile";
}

export function oauthCallbackUrl(origin: string, provider: OAuthProvider, next: string) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next.startsWith("/") ? next : "/dashboard");
  url.searchParams.set("provider", provider);
  return url.toString();
}

export function oauthSignInOptions(provider: OAuthProvider, redirectTo: string) {
  const options: {
    redirectTo: string;
    scopes: string;
    queryParams?: Record<string, string>;
  } = {
    redirectTo,
    scopes: oauthScopes(provider),
  };

  if (provider === "google") {
    // Always show Google's account picker instead of auto-signing into the last account.
    options.queryParams = { prompt: "select_account" };
  }

  return options;
}
