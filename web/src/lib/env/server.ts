/**
 * Server-only environment variables. Import only from API routes, Server Components,
 * and server actions — never from client components.
 */

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

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => optional("SUPABASE_SERVICE_ROLE_KEY"),
  siteUrl: () => optional("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",
  databaseUrl: () => optional("DATABASE_URL"),
  authSecret: () => optional("AUTH_SECRET"),
  screeningDevBypass: () => process.env.SCREENING_DEV_BYPASS === "true",
} as const;

export function assertSupabaseConfigured(): void {
  serverEnv.supabaseUrl();
  serverEnv.supabaseAnonKey();
}
