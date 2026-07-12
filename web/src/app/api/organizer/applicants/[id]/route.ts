import { NextResponse, type NextRequest } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Body = { action?: "accept" | "decline" };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = await isOrganizerMember(supabase, user);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: row, error } = await admin
    .from("event_signup_requests")
    .select("id, event_id, ref_member_id, status, scheduled_events!inner ( organizer_member_id, pay_offer )")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "Application not found" }, { status: 404 });
  }

  const event = Array.isArray(row.scheduled_events) ? row.scheduled_events[0] : row.scheduled_events;
  if (event?.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.action === "decline") {
    const { error: updateError } = await admin
      .from("event_signup_requests")
      .update({ status: "declined" })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  const { error: offerError } = await admin.from("assignment_offers").insert({
    event_id: row.event_id,
    ref_member_id: row.ref_member_id,
    offered_pay: event?.pay_offer ?? null,
    message: "Your application was accepted — please confirm this assignment.",
    status: "pending",
  });

  if (offerError && !/duplicate|unique/i.test(offerError.message)) {
    return NextResponse.json({ error: offerError.message }, { status: 400 });
  }

  const { error: acceptError } = await admin
    .from("event_signup_requests")
    .update({ status: "accepted" })
    .eq("id", id);
  if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 400 });

  return NextResponse.json({ ok: true, status: "accepted" });
}
