import { NextResponse, type NextRequest } from "next/server";
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
  let eventsQuery = admin
    .from("scheduled_events")
    .select(
      "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, pay_type, pay_min, pay_max, notes"
    )
    .eq("status", "published")
    .gte("starts_at", startsAfter || now)
    .order("starts_at", { ascending: true })
    .limit(200);

  if (startsBefore) {
    eventsQuery = eventsQuery.lte("starts_at", startsBefore);
  }

  let { data: events, error: eventsErr } = await eventsQuery;
  if (isMissingPayRangeColumn(eventsErr)) {
    const fallback = await admin
      .from("scheduled_events")
      .select(
        "id, title, sport, starts_at, ends_at, city, state, zip_code, officials_needed, pay_offer, notes"
      )
      .eq("status", "published")
      .gte("starts_at", startsAfter || now)
      .order("starts_at", { ascending: true })
      .limit(200);
    events = fallback.data as typeof events;
    eventsErr = fallback.error;
  }

  if (eventsErr) {
    return NextResponse.json({ error: eventsErr.message, events: [] }, { status: 400 });
  }

  const eventIds = (events ?? []).map((event) => event.id);
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

  const enriched: OpenEventRecord[] = (events ?? []).map((event) => ({
    ...(event as OpenEventRecord),
    booked_count: bookingCounts.get(event.id) ?? 0,
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
