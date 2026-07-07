/**
 * Server-only environment variables. Import only from API routes, Server Components,
 * and server actions — never from client components.
 */

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function supabaseSecretKey(): string | undefined {
  return optional("SUPABASE_SECRET_KEY") || optional("SUPABASE_SERVICE_ROLE_KEY");
}

export const serverEnv = {
  supabaseUrl: () => getSupabaseUrl() || required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => getSupabasePublicKey() || required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseServiceRoleKey: () => supabaseSecretKey(),
  siteUrl: () => optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  databaseUrl: () => optional("DATABASE_URL"),
  authSecret: () => optional("AUTH_SECRET"),
  screeningDevBypass: () => process.env.SCREENING_DEV_BYPASS === "true",
} as const;

export function assertSupabaseConfigured(): void {
  serverEnv.supabaseUrl();
  serverEnv.supabaseAnonKey();
}
