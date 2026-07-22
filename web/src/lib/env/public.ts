/**
 * Public (browser-safe) environment values only.
 *
 * Anything here is compiled into the client bundle. Never put service-role keys,
 * Resend, Stripe, OAuth client secrets, or other private credentials here.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* when accessed with a static path
 * (process.env.NEXT_PUBLIC_FOO). Dynamic process.env[name] is empty in the browser.
 */

function looksLikePlaceholder(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    upper.includes("YOUR_PROJECT") ||
    upper.includes("YOUR_SUPABASE") ||
    upper.includes("YOUR_ANON") ||
    upper.includes("PLACEHOLDER") ||
    upper.startsWith("YOUR_")
  );
}

export const publicEnv = {
  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  supabasePublishableKey: () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  googleMapsApiKey: () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "",
} as const;

/** True when real Supabase URL + anon key are set (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = publicEnv.supabaseUrl();
  const key = publicEnv.supabaseAnonKey();
  if (!url || !key) return false;
  return !looksLikePlaceholder(url) && !looksLikePlaceholder(key);
}

export const SUPABASE_SETUP_HINT =
  "Supabase is not configured. In web/.env.local set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your Supabase project (Settings → API), then restart npm run dev.";
