import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RatingBody = {
  eventId?: string;
  refMemberId?: string;
  score?: number | null;
  skipped?: boolean;
  comment?: string | null;
};

/** Public reviews for a referee (Airbnb-style profile reviews). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refMemberId = searchParams.get("refMemberId")?.trim();
  if (!refMemberId) {
    return NextResponse.json({ error: "refMemberId is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: ratings, error } = await admin
    .from("ref_ratings")
    .select(
      "id, score, comment, created_at, organizer_member_id, event_id, skipped, members!ref_ratings_organizer_member_id_fkey ( display_name ), scheduled_events ( title )"
    )
    .eq("ref_member_id", refMemberId)
    .eq("skipped", false)
    .not("score", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Fallback without embeds if FK names differ
    const fallback = await admin
      .from("ref_ratings")
      .select("id, score, comment, created_at, organizer_member_id, event_id, skipped")
      .eq("ref_member_id", refMemberId)
      .eq("skipped", false)
      .not("score", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 400 });
    }

    const orgIds = [...new Set((fallback.data ?? []).map((r) => r.organizer_member_id))];
    const eventIds = [...new Set((fallback.data ?? []).map((r) => r.event_id))];
    const [{ data: orgs }, { data: events }] = await Promise.all([
      orgIds.length
        ? admin.from("members").select("id, display_name").in("id", orgIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
      eventIds.length
        ? admin.from("scheduled_events").select("id, title").in("id", eventIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.display_name]));
    const eventMap = new Map((events ?? []).map((e) => [e.id, e.title]));

    const reviews = (fallback.data ?? []).map((r) => ({
      id: r.id,
      score: r.score as number,
      comment: r.comment ?? null,
      createdAt: r.created_at,
      authorLabel: orgMap.get(r.organizer_member_id)?.trim() || "Host",
      eventTitle: eventMap.get(r.event_id) ?? null,
    }));

    const count = reviews.length;
    const average = count
      ? Number((reviews.reduce((sum, r) => sum + r.score, 0) / count).toFixed(2))
      : null;

    return NextResponse.json({ refMemberId, average, count, reviews });
  }

  const reviews = (ratings ?? []).map((r) => {
    const member = Array.isArray(r.members) ? r.members[0] : r.members;
    const event = Array.isArray(r.scheduled_events) ? r.scheduled_events[0] : r.scheduled_events;
    return {
      id: r.id as string,
      score: r.score as number,
      comment: (r.comment as string | null) ?? null,
      createdAt: r.created_at as string,
      authorLabel: (member as { display_name?: string } | null)?.display_name?.trim() || "Host",
      eventTitle: (event as { title?: string } | null)?.title ?? null,
    };
  });

  const count = reviews.length;
  const average = count
    ? Number((reviews.reduce((sum, r) => sum + r.score, 0) / count).toFixed(2))
    : null;

  return NextResponse.json({ refMemberId, average, count, reviews });
}

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
    if (!rawComment) {
      return NextResponse.json(
        { error: "A written review is required to publish — just like Airbnb." },
        { status: 400 }
      );
    }
    comment = rawComment.slice(0, 1000);
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

  const { data: acceptedOffer } = await supabase
    .from("assignment_offers")
    .select("id")
    .eq("event_id", body.eventId)
    .eq("ref_member_id", body.refMemberId)
    .eq("status", "accepted")
    .maybeSingle();

  if (!booking && !acceptedOffer) {
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
