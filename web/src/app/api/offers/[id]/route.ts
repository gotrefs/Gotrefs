import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Action = "accept" | "decline" | "cancel";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: Action;
  try {
    const b = (await request.json()) as { action?: string };
    if (b.action !== "accept" && b.action !== "decline" && b.action !== "cancel") {
      return NextResponse.json(
        { error: "action must be accept, decline, or cancel" },
        { status: 400 }
      );
    }
    action = b.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: offer, error: oErr } = await supabase
    .from("assignment_offers")
    .select("id, ref_member_id, status, event_id")
    .eq("id", id)
    .single();

  if (oErr || !offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const isRef = offer.ref_member_id === user.id;
  let isOrg = false;
  if (!isRef) {
    const { data: ev } = await supabase
      .from("scheduled_events")
      .select("organizer_member_id")
      .eq("id", offer.event_id)
      .single();
    isOrg = ev?.organizer_member_id === user.id;
  }

  if (!isRef && !isOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offer.status !== "pending") {
    return NextResponse.json({ error: "Offer is no longer pending" }, { status: 400 });
  }

  if (action === "accept" && !isRef) {
    return NextResponse.json({ error: "Only the referee can accept" }, { status: 403 });
  }

  if (action === "decline" && !isRef) {
    return NextResponse.json({ error: "Only the referee can decline" }, { status: 403 });
  }

  if (action === "cancel" && !isOrg) {
    return NextResponse.json({ error: "Only the organizer can cancel an offer" }, { status: 403 });
  }

  const nextStatus =
    action === "accept" ? "accepted" : action === "cancel" ? "canceled" : "declined";
  const { error: uErr } = await supabase
    .from("assignment_offers")
    .update({ status: nextStatus })
    .eq("id", id);

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
