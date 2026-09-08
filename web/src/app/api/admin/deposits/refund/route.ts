import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";
import {
  OrganizerChargeError,
  refundEventDeposit,
} from "@/lib/stripe/charge-organizer-for-offer";

/** Admin force-refund of unused event deposit (even before event end). */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const eventId = body.eventId?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  try {
    const result = await refundEventDeposit(admin, { eventId, force: true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof OrganizerChargeError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Could not refund deposit.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
