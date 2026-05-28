import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  eventId: string;
  refMemberId: string;
  offeredPay?: number | null;
  message?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.eventId || !body.refMemberId) {
    return NextResponse.json({ error: "eventId and refMemberId required" }, { status: 400 });
  }

  const { data: event, error: evErr } = await supabase
    .from("scheduled_events")
    .select("id, organizer_member_id")
    .eq("id", body.eventId)
    .single();

  if (evErr || !event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found or not yours" }, { status: 403 });
  }

  const { data: refRow, error: refErr } = await supabase
    .from("screening_checks")
    .select("status")
    .eq("ref_member_id", body.refMemberId)
    .maybeSingle();

  if (refErr || !refRow || refRow.status !== "clear") {
    return NextResponse.json(
      { error: "You can only offer to refs who have completed screening (clear)." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("assignment_offers")
    .insert({
      event_id: body.eventId,
      ref_member_id: body.refMemberId,
      offered_pay: body.offeredPay ?? null,
      message: body.message ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, offerId: data.id });
}
