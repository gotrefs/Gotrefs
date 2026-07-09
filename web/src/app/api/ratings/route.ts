import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RatingBody = {
  eventId?: string;
  refMemberId?: string;
  score?: number | null;
  skipped?: boolean;
  comment?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RatingBody;
  try {
    body = (await request.json()) as RatingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.eventId || !body.refMemberId) {
    return NextResponse.json({ error: "eventId and refMemberId are required." }, { status: 400 });
  }

  const skipped = Boolean(body.skipped);
  let score: number | null = null;
  let comment: string | null = null;
  if (!skipped) {
    const submittedScore = Number(body.score);
    if (!Number.isInteger(submittedScore) || submittedScore < 1 || submittedScore > 5) {
      return NextResponse.json({ error: "Score must be a whole number from 1 to 5." }, { status: 400 });
    }
    score = submittedScore;
    const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
    comment = rawComment ? rawComment.slice(0, 1000) : null;
  }

  const { data: event, error: eventError } = await supabase
    .from("scheduled_events")
    .select("id, organizer_member_id, ends_at")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found or not yours." }, { status: 403 });
  }

  if (new Date(event.ends_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "Ratings open after the game ends." }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("event_id", body.eventId)
    .eq("ref_member_id", body.refMemberId)
    .eq("organizer_member_id", user.id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Only booked refs can be rated." }, { status: 400 });
  }

  const { error } = await supabase.from("ref_ratings").upsert(
    {
      event_id: body.eventId,
      ref_member_id: body.refMemberId,
      organizer_member_id: user.id,
      score,
      comment,
      skipped,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,ref_member_id,organizer_member_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
