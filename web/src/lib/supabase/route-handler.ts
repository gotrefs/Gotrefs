import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

/** Supabase client for Route Handlers — session cookies must be set on the response. */
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

/** Copy Set-Cookie headers from one NextResponse onto another (e.g. after auth). */
export function jsonWithSessionCookies(
  sessionResponse: NextResponse,
  body: Record<string, unknown>,
  init?: ResponseInit
): NextResponse {
  const jsonResponse = NextResponse.json(body, init);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    jsonResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return jsonResponse;
}
