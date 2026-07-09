/**
 * Server-only environment variables. Import only from API routes, Server Components,
 * and server actions — never from client components.
 */

import type { NextRequest } from "next/server";

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
  skipEmailConfirmation: () => process.env.AUTH_SKIP_EMAIL_CONFIRMATION === "true",
} as const;

/** Prefer configured site URL; fall back to the live request origin when env still points at localhost. */
export function resolveSiteUrl(requestOrigin?: string | null): string {
  const configured = optional("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "");
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
export function resolveSiteUrlFromRequest(request: NextRequest): string {
  const configured = optional("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host"))?.split(",")[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  if (host && !host.includes("localhost")) {
    return `${protocol}://${host}`;
  }

  const vercelUrl = optional("VERCEL_URL");
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

export function assertSupabaseConfigured(): void {
  serverEnv.supabaseUrl();
  serverEnv.supabaseAnonKey();
}
