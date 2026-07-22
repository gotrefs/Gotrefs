/**
 * Server-only secrets and config.
 *
 * Import ONLY from API routes, Server Components, Server Actions, and other
 * server modules. Importing this file into a Client Component will fail the build
 * (`server-only`), which keeps secrets out of the browser bundle.
 *
 * Source of truth: `web/.env.local` (gitignored + cursorignored). Never commit
 * real values. Never paste secrets into chat — edit `.env.local` on disk instead.
 */

import "server-only";

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function required(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function looksLikePlaceholder(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    upper.includes("YOUR_PROJECT") ||
    upper.includes("YOUR_SUPABASE") ||
    upper.includes("YOUR_ANON") ||
    upper.includes("PLACEHOLDER") ||
    upper === "CHANGE_ME" ||
    upper.startsWith("YOUR_")
  );
}

/** True when real Supabase URL + anon key are set (not placeholders). */
export function isSupabaseEnvReady(): boolean {
  const url = read("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  const key = read("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "";
  if (!url || !key) return false;
  return !looksLikePlaceholder(url) && !looksLikePlaceholder(key);
}

export const serverEnv = {
  // Public identifiers (also available via NEXT_PUBLIC_* on the client)
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  siteUrl: () => read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000",

  // Server-only secrets — never prefix with NEXT_PUBLIC_
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseSecretKey: () => read("SUPABASE_SECRET_KEY"),
  databaseUrl: () => read("DATABASE_URL"),
  authSecret: () => read("AUTH_SECRET"),
  resendApiKey: () => read("RESEND_API_KEY"),
  resendFromEmail: () => read("RESEND_FROM_EMAIL"),
  openaiApiKey: () => read("OPENAI_API_KEY"),
  checkrApiKey: () => read("CHECKR_API_KEY"),
  checkrWebhookSecret: () => read("CHECKR_WEBHOOK_SECRET"),
  stripeSecretKey: () => read("STRIPE_SECRET_KEY"),
  googleClientId: () => read("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => read("GOOGLE_CLIENT_SECRET"),
  facebookClientId: () => read("FACEBOOK_CLIENT_ID"),
  facebookClientSecret: () => read("FACEBOOK_CLIENT_SECRET"),
  appleClientId: () => read("APPLE_CLIENT_ID"),
  appleTeamId: () => read("APPLE_TEAM_ID"),
  appleKeyId: () => read("APPLE_KEY_ID"),
  applePrivateKey: () => read("APPLE_PRIVATE_KEY"),

  // Feature flags / ops
  adminEmails: () => read("GOTREFS_ADMIN_EMAILS"),
  screeningDevBypass: () => process.env.SCREENING_DEV_BYPASS === "true",
  skipEmailConfirmation: () => process.env.AUTH_SKIP_EMAIL_CONFIRMATION === "true",
} as const;

export function requireServiceRoleKey(): string {
  const key = serverEnv.supabaseServiceRoleKey();
  if (!key || looksLikePlaceholder(key)) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  }
  return key;
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseEnvReady()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local."
    );
  }
  serverEnv.supabaseUrl();
  serverEnv.supabaseAnonKey();
}

/** Prefer configured site URL; fall back to the live request origin when env still points at localhost. */
export function resolveSiteUrl(requestOrigin?: string | null): string {
  const configured = read("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "");
  const origin = requestOrigin?.replace(/\/$/, "") || "";

  if (configured && !configured.includes("localhost")) {
    return configured;
  }
  if (origin && !origin.includes("localhost")) {
    return origin;
  }
  return configured || "http://localhost:3000";
}

/** Resolve public site URL from an incoming API request (works on Vercel behind proxies). */
export function resolveSiteUrlFromRequest(request: {
  headers: { get(name: string): string | null };
  url: string;
}): string {
  const configured = read("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host"))?.split(",")[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  if (host && !host.includes("localhost")) {
    return `${protocol}://${host}`;
  }

  const vercelUrl = read("VERCEL_URL");
  if (vercelUrl && !vercelUrl.includes("localhost")) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  if (configured && !configured.includes("localhost")) {
    return configured;
  }

  try {
    const origin = new URL(request.url).origin;
    if (origin && !origin.includes("localhost")) {
      return origin;
    }
  } catch {
    // Ignore malformed request URLs.
  }

  return configured || "http://localhost:3000";
}
