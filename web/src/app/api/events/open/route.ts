import { NextResponse, type NextRequest } from "next/server";
import { computeAppliedBoosts } from "@/lib/boosts";
import {
  filterOpenEvents,
  type OpenEventRecord,
  type RefProfileForMatch,
} from "@/lib/marketplace/event-filters";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function isMissingPayRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["pay_type", "pay_min", "pay_max"].some((column) => message.includes(column));
}

function isMissingBoostsColumn(error: { message?: string } | null | undefined) {
  return (error?.message ?? "").includes("boosts");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in.", events: [] }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const sport = params.get("sport");
  const zip = params.get("zip");
  const startsAfter = params.get("startsAfter");
  const startsBefore = params.get("startsBefore");
  const payMatchesRef = params.get("payMatchesRef") === "true";

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const now = new Date().toISOString();
  const baseColumns =
    "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, notes, organizer_member_id";
  const selectCandidates = [
    `${baseColumns}, pay_type, pay_min, pay_max, boosts`,
    `${baseColumns}, pay_type, pay_min, pay_max`,
    baseColumns,
  ];

  let events: Record<string, unknown>[] | null = null;
  let eventsErr: { message?: string } | null = null;
  for (const columns of selectCandidates) {
    let eventsQuery = admin
      .from("scheduled_events")
      .select(columns)
      .eq("status", "published")
      .gte("starts_at", startsAfter || now)
      .order("starts_at", { ascending: true })
      .limit(200);
    if (startsBefore) {
      eventsQuery = eventsQuery.lte("starts_at", startsBefore);
    }
    const result = await eventsQuery;
    events = result.data as Record<string, unknown>[] | null;
    eventsErr = result.error;
    if (!eventsErr) break;
    if (!isMissingBoostsColumn(eventsErr) && !isMissingPayRangeColumn(eventsErr)) break;
  }

  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message, events: [] }, { status: 400 });
  }

  const eventRows = (events ?? []) as unknown as (OpenEventRecord & {
    organizer_member_id?: string;
    boosts?: string[] | null;
  })[];
  const eventIds = eventRows.map((event) => event.id);
  const bookingCounts = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: bookings } = await admin
      .from("bookings")
      .select("event_id")
      .in("event_id", eventIds)
      .in("status", ["confirmed", "completed"]);
    for (const row of bookings ?? []) {
      bookingCounts.set(row.event_id, (bookingCounts.get(row.event_id) ?? 0) + 1);
    }
  }

  // Accepted-offer counts per organizer power the "first 10 refs" and
  // "multi-game" boost badges shown to this ref.
  const organizerIds = Array.from(
    new Set(eventRows.map((event) => event.organizer_member_id).filter((id): id is string => Boolean(id)))
  );
  const organizerAcceptedCounts = new Map<string, number>();
  const refAcceptedWithOrganizerCounts = new Map<string, number>();
  const anyBoosts = eventRows.some((event) => (event.boosts ?? []).length > 0);
  if (organizerIds.length > 0 && anyBoosts) {
    const { data: acceptedOffers } = await admin
      .from("assignment_offers")
      .select("ref_member_id, scheduled_events!inner(organizer_member_id)")
      .eq("status", "accepted")
      .in("scheduled_events.organizer_member_id", organizerIds)
      .limit(5000);
    for (const offer of acceptedOffers ?? []) {
      const joined = Array.isArray(offer.scheduled_events) ? offer.scheduled_events[0] : offer.scheduled_events;
      const organizerId = (joined as { organizer_member_id?: string } | null)?.organizer_member_id;
      if (!organizerId) continue;
      organizerAcceptedCounts.set(organizerId, (organizerAcceptedCounts.get(organizerId) ?? 0) + 1);
      if (offer.ref_member_id === user.id) {
        refAcceptedWithOrganizerCounts.set(
          organizerId,
          (refAcceptedWithOrganizerCounts.get(organizerId) ?? 0) + 1
        );
      }
    }
  }

  let refProfile: RefProfileForMatch | null = null;
  const { data: member } = await admin.from("members").select("home_zip").eq("id", user.id).maybeSingle();
  const { data: profile } = await admin
    .from("ref_profiles")
    .select(
      "primary_sport, additional_sports, rate_type, rate_min, rate_max, rate_per_game, rate_unit, travel_radius_miles"
    )
    .eq("member_id", user.id)
    .maybeSingle();
  if (profile || member) {
    refProfile = {
      ...(profile ?? {}),
      home_zip: member?.home_zip ?? null,
    };
  }

  const enriched: OpenEventRecord[] = eventRows.map((event) => ({
    ...event,
    booked_count: bookingCounts.get(event.id) ?? 0,
    active_boosts: computeAppliedBoosts({
      eventBoosts: event.boosts,
      eventStartsAt: event.starts_at,
      organizerAcceptedCount: event.organizer_member_id
        ? organizerAcceptedCounts.get(event.organizer_member_id) ?? 0
        : 0,
      refAcceptedWithOrganizerCount: event.organizer_member_id
        ? refAcceptedWithOrganizerCounts.get(event.organizer_member_id) ?? 0
        : 0,
    }),
  }));

  const filtered = filterOpenEvents(enriched, {
    sport,
    zip,
    startsAfter,
    startsBefore,
    payMatchesRef,
    refProfile,
  });

  return NextResponse.json({ events: filtered, refProfile });
}
