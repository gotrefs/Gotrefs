/** True when real Supabase URL + anon key are set (not placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) return false;
  const placeholder =
    url.includes("placeholder") ||
    url.includes("YOUR_PROJECT") ||
    key.includes("placeholder") ||
    key.includes("YOUR_SUPABASE") ||
    key.includes("YOUR_ANON");
  return !placeholder;
}

export const SUPABASE_SETUP_HINT =
  "Supabase is not configured. In web/.env.local set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your Supabase project (Settings → API), then restart npm run dev.";
