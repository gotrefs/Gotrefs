import { NextResponse } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { payBounds } from "@/lib/pay-range";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type EventJoin = {
  title: string;
  sport?: string | null;
  starts_at?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  pay_offer: number | null;
  pay_type?: string | null;
  pay_min?: number | null;
  pay_max?: number | null;
  organizer_member_id: string;
};

type ApplicantRow = {
  id: string;
  event_id: string;
  ref_member_id: string;
  created_at: string;
  scheduled_events: EventJoin | EventJoin[] | null;
};

function eventFromJoin(value: EventJoin | EventJoin[] | null | undefined): EventJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", applicants: [] }, { status: 401 });
  }

  const canView = await isOrganizerMember(supabase, user);
  if (!canView) {
    return NextResponse.json({ applicants: [] });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error.", applicants: [] }, { status: 503 });
  }

  // Resolve this organizer's events first — avoids brittle nested filters that 400 in PostgREST.
  const { data: orgEvents, error: eventsError } = await admin
    .from("scheduled_events")
    .select("id")
    .eq("organizer_member_id", user.id);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message, applicants: [] }, { status: 400 });
  }

  const eventIds = (orgEvents ?? []).map((row) => row.id);
  if (eventIds.length === 0) {
    return NextResponse.json({ applicants: [] });
  }

  const selectFull =
    "id, event_id, ref_member_id, created_at, scheduled_events!inner ( title, sport, starts_at, city, state, zip_code, pay_offer, pay_type, pay_min, pay_max, organizer_member_id )";
  const selectBase =
    "id, event_id, ref_member_id, created_at, scheduled_events!inner ( title, sport, starts_at, city, state, zip_code, pay_offer, organizer_member_id )";

  let rows: ApplicantRow[] | null = null;
  let error: { message?: string } | null = null;
  {
    const result = await admin
      .from("event_signup_requests")
      .select(selectFull)
      .in("event_id", eventIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    rows = result.data as ApplicantRow[] | null;
    error = result.error;
  }
  if (error && ["pay_type", "pay_min", "pay_max"].some((col) => (error?.message ?? "").includes(col))) {
    const result = await admin
      .from("event_signup_requests")
      .select(selectBase)
      .in("event_id", eventIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    rows = result.data as ApplicantRow[] | null;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message, applicants: [] }, { status: 400 });
  }

  const applicants = (rows ?? []).filter((row) => {
    const event = eventFromJoin(row.scheduled_events);
    return event?.organizer_member_id === user.id;
  });
  const refIds = Array.from(new Set(applicants.map((row) => row.ref_member_id)));

  const { data: profiles } = await admin
    .from("ref_profiles")
    .select(
      "member_id, gotrefs_id, rate_type, rate_min, rate_max, rate_per_game, rate_unit, primary_sport, additional_sports, certification_level"
    )
    .in("member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: members } = await admin
    .from("members")
    .select("id, display_name, profile_picture_url")
    .in("id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileByRef = new Map((profiles ?? []).map((profile) => [profile.member_id, profile]));
  const memberByRef = new Map((members ?? []).map((member) => [member.id, member]));

  const { data: ratings } = await admin
    .from("ref_ratings")
    .select("ref_member_id, score, skipped, comment, created_at, organizer_member_id")
    .in("ref_member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("skipped", false)
    .not("score", "is", null)
    .order("created_at", { ascending: false });

  const orgIds = [...new Set((ratings ?? []).map((r) => r.organizer_member_id).filter(Boolean))];
  const { data: orgMembers } =
    orgIds.length > 0
      ? await admin.from("members").select("id, display_name").in("id", orgIds)
      : { data: [] as { id: string; display_name: string }[] };
  const orgNameById = new Map((orgMembers ?? []).map((m) => [m.id, m.display_name]));

  const ratingSummaryByRef = new Map<
    string,
    {
      total: number;
      count: number;
      reviews: Array<{
        score: number;
        comment: string | null;
        createdAt: string;
        authorLabel: string;
      }>;
    }
  >();
  for (const rating of ratings ?? []) {
    if (typeof rating.score !== "number") continue;
    const next = ratingSummaryByRef.get(rating.ref_member_id) ?? { total: 0, count: 0, reviews: [] };
    next.total += rating.score;
    next.count += 1;
    if (next.reviews.length < 8) {
      next.reviews.push({
        score: rating.score,
        comment: rating.comment ?? null,
        createdAt: rating.created_at,
        authorLabel: orgNameById.get(rating.organizer_member_id)?.trim() || "Host",
      });
    }
    ratingSummaryByRef.set(rating.ref_member_id, next);
  }

  const enriched = [];
  for (const row of applicants) {
    const event = eventFromJoin(row.scheduled_events);
    const profile = profileByRef.get(row.ref_member_id);
    const member = memberByRef.get(row.ref_member_id);
    const rating = ratingSummaryByRef.get(row.ref_member_id);

    let gotrefsId = profile?.gotrefs_id ?? null;
    if (!gotrefsId) {
      const { data: authUser } = await admin.auth.admin.getUserById(row.ref_member_id);
      gotrefsId =
        typeof authUser?.user?.user_metadata?.gotrefs_id === "string"
          ? authUser.user.user_metadata.gotrefs_id
          : `GR-${row.ref_member_id.slice(0, 8).toUpperCase()}`;
    }

    const refBounds = payBounds({
      type: profile?.rate_type === "range" ? "range" : "exact",
      exact: profile?.rate_per_game,
      min: profile?.rate_min,
      max: profile?.rate_max,
    });
    const eventBounds = payBounds({
      type: event?.pay_type === "range" ? "range" : "exact",
      exact: event?.pay_offer,
      min: event?.pay_min,
      max: event?.pay_max,
    });

    const place = [event?.city, event?.state].filter(Boolean).join(", ") || event?.zip_code || null;
    const eventWhen = event?.starts_at
      ? new Date(event.starts_at).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

    enriched.push({
      id: row.id,
      eventId: row.event_id,
      refMemberId: row.ref_member_id,
      createdAt: row.created_at,
      gotrefsId,
      displayName: member?.display_name ?? null,
      primarySport: profile?.primary_sport ?? event?.sport ?? null,
      additionalSports: profile?.additional_sports ?? [],
      certificationLevel: profile?.certification_level ?? null,
      avatarPath: member?.profile_picture_url ?? null,
      eventTitle: event?.title ?? "Event",
      eventPlace: place,
      eventWhen,
      eventPayLabel:
        eventBounds.min != null
          ? eventBounds.max != null && eventBounds.max > eventBounds.min
            ? `$${eventBounds.min}-$${eventBounds.max}`
            : `$${eventBounds.min}`
          : null,
      refRateLabel:
        refBounds.min != null
          ? refBounds.max != null && refBounds.max > refBounds.min
            ? `$${refBounds.min}-$${refBounds.max}/${profile?.rate_unit === "game" ? "game" : "hr"}`
            : `$${refBounds.min}/${profile?.rate_unit === "game" ? "game" : "hr"}`
          : null,
      ratingAverage: rating?.count ? Number((rating.total / rating.count).toFixed(1)) : null,
      ratingCount: rating?.count ?? 0,
      reviews: rating?.reviews ?? [],
    });
  }

  return NextResponse.json({ applicants: enriched });
}
