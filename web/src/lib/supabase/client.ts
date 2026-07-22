import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

export function createClient() {
  const url = publicEnv.supabaseUrl();
  const key = publicEnv.supabaseAnonKey();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, key);
}
