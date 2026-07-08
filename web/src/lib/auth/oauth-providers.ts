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
  const url = new URL(`/api/auth/callback/${provider}`, origin);
  url.searchParams.set("next", next.startsWith("/") ? next : "/dashboard");
  return url.toString();
}
