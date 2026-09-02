import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  confirmEventPayment,
  OrganizerChargeError,
  previewConfirmEventPayment,
  depositRefundableCents,
  getEventDeposit,
} from "@/lib/stripe/charge-organizer-for-offer";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId")?.trim();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: event } = await admin
    .from("scheduled_events")
    .select("id, title, ends_at, organizer_member_id, pay_offer")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    const deposit = await getEventDeposit(admin, eventId);
    let breakdown = null;
    try {
      const preview = await previewConfirmEventPayment(admin, { eventId });
      breakdown = preview.breakdown;
    } catch (err) {
      if (!(err instanceof OrganizerChargeError && err.code === "nothing_to_pay")) {
        throw err;
      }
    }

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        endsAt: event.ends_at,
        payOffer: event.pay_offer,
      },
      breakdown,
      deposit: deposit
        ? {
            requiredCents: deposit.required_cents,
            collectedCents: deposit.collected_cents,
            appliedCents: deposit.applied_cents,
            refundedCents: deposit.refunded_cents,
            refundableCents: depositRefundableCents(deposit),
            status: deposit.status,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof OrganizerChargeError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Could not preview payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { eventId?: string; offerIds?: string[] };
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
    const result = await confirmEventPayment(admin, {
      eventId,
      organizerMemberId: user.id,
      offerIds: Array.isArray(body.offerIds) ? body.offerIds : undefined,
    });
    return NextResponse.json({
      ok: true,
      paymentId: result.paymentId,
      breakdown: result.breakdown,
    });
  } catch (err) {
    if (err instanceof OrganizerChargeError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Could not confirm payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
