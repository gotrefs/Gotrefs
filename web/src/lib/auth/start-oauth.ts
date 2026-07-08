import { createClient } from "@/lib/supabase/client";
import { oauthCallbackUrl, oauthScopes, type OAuthProvider } from "./oauth-providers";

/** Start OAuth in the browser so the PKCE verifier is stored in cookies via @supabase/ssr. */
export async function startOAuthSignIn(provider: OAuthProvider, next = "/dashboard") {
  const supabase = createClient();
  const redirectTo = oauthCallbackUrl(window.location.origin, provider, next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: oauthScopes(provider),
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("OAuth provider did not return a redirect URL.");

  window.location.assign(data.url);
}
