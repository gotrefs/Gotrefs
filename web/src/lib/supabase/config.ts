/** Client-safe Supabase URL + publishable/anon API key (supports legacy JWT and sb_publishable_* keys). */

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getSupabasePublicKey(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseUrl(): string {
  return readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** True when real Supabase URL + publishable/anon key are set (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) return false;

  const placeholder =
    url.includes("placeholder") ||
    url.includes("YOUR_PROJECT") ||
    key.includes("placeholder") ||
    key.includes("YOUR_SUPABASE") ||
    key.includes("YOUR_ANON") ||
    key === "your_anon_key_here";

  return !placeholder;
}

export const SUPABASE_SETUP_HINT =
  "Supabase is not configured. In web/.env.local set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) from your Supabase project (Settings → API), then restart npm run dev.";
