import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CheckoutBody = {
  eventId?: string;
};

/**
 * Manual event Checkout is deprecated.
 * Organizers save a payment method under Payments; charges run automatically when a
 * referee accepts an offer (or when an organizer hires an applicant).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from("scheduled_events")
    .select("id, organizer_member_id")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found or not yours." }, { status: 403 });
  }

  return NextResponse.json(
    {
      error:
        "Event Checkout is no longer used. Add a card or bank under Payments. Offers are charged automatically when a referee accepts (or when you hire an applicant).",
    },
    { status: 410 }
  );
}
