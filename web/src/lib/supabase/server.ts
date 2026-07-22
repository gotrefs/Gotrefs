import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env/server";

export async function createClient() {
  const cookieStore = await cookies();
  const url = serverEnv.supabaseUrl();
  const key = serverEnv.supabaseAnonKey();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              httpOnly: true,
              ...options,
            })
          );
        } catch {
          /* ignore when called from a Server Component */
        }
      },
    },
  });
}
