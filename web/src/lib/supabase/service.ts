import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireServiceRoleKey, serverEnv } from "@/lib/env/server";

/** Server-only client for webhooks and trusted updates. Never import from client code. */
export function createServiceClient() {
  const url = serverEnv.supabaseUrl();
  const key = requireServiceRoleKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
