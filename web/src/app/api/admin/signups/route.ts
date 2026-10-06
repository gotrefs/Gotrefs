import { NextResponse } from "next/server";
import { loadAllSignups } from "@/lib/admin/signups";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Admin only: every real account that has signed up (refs and organizers). */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  try {
    const signups = await loadAllSignups(createServiceClient());
    return NextResponse.json(
      { signups, total: signups.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load signups.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
