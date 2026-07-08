"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oauthCallbackUrl, oauthSignInOptions, type OAuthProvider } from "@/lib/auth/oauth-providers";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/supabase/route-handler";

async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Start OAuth on the server so the PKCE verifier is written to cookies before redirecting. */
export async function signInWithOAuthAction(provider: OAuthProvider, next?: string | null) {
  const supabase = await createClient();
  const origin = await requestOrigin();
  const safeNext = safeRedirectPath(next ?? null);
  const redirectTo = oauthCallbackUrl(origin, provider, safeNext);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: oauthSignInOptions(provider, redirectTo),
  });

  if (error || !data.url) {
    redirect(
      `/auth/login?error=oauth_start_failed&reason=${encodeURIComponent(error?.message ?? "No URL")}`
    );
  }

  redirect(data.url);
}
