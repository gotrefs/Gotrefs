import { NextResponse } from "next/server";
import { loadUpcomingEvents } from "@/lib/admin/upcoming-events";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Admin only: upcoming events with the REFS booked, invited or requesting each one. */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  try {
    const events = await loadUpcomingEvents(createServiceClient());
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load events.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
