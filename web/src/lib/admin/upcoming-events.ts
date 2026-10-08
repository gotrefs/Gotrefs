import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimesheetStatus } from "@/lib/timesheets";

/** A REF attached to an event, as the admin sees them (contact info included: admin only). */
export type AdminEventRef = {
  memberId: string;
  name: string;
  gotrefsId: string;
  email: string;
  phone: string;
  /** booked = confirmed; invited = organizer sent an offer; requested = REF asked to work it. */
  kind: "booked" | "invited" | "requested";
  /** Booked REFS: check-in progress at the event. */
  timesheetStatus: TimesheetStatus | null;
  games: number | null;
  pay: number | null;
};

export type AdminUpcomingEvent = {
  id: string;
  title: string;
  sport: string;
  status: string;
  startsAt: string;
  endsAt: string;
  place: string;
  refsNeeded: number;
  organizer: { memberId: string; name: string; organization: string; email: string; phone: string };
  refs: AdminEventRef[];
};

type EventRow = {
  id: string;
  organizer_member_id: string;
  title: string | null;
  sport: string | null;
  status: string | null;
  starts_at: string;
  ends_at: string;
  officials_needed: number | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  venue_street?: string | null;
};

type MemberRow = {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization_name?: string | null;
  is_seed?: boolean | null;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX_EVENTS = 300;

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rows whose `column` is in `ids`, fetched in chunks so long id lists stay under URL limits. */
async function rowsIn<T>(admin: SupabaseClient, table: string, select: string, column: string, ids: string[]) {
  const rows: T[] = [];
  for (const part of chunks([...new Set(ids)])) {
    if (part.length === 0) continue;
    const { data, error } = await admin.from(table).select(select).in(column, part);
    if (error) {
      // Optional tables (timesheets) may not exist yet; everything else should.
      if (table === "booking_timesheets") return [] as T[];
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...((data as T[] | null) ?? []));
  }
  return rows;
}

function memberName(m: MemberRow | undefined) {
  if (!m) return "Unknown";
  return [text(m.first_name), text(m.last_name)].filter(Boolean).join(" ") || text(m.display_name) || "Unknown";
}

/**
 * Admin: events that haven't ended yet (soonest first), with the organizer and every REF
 * booked, invited or requesting each one. Events from sample organizers are left out.
 */
export async function loadUpcomingEvents(admin: SupabaseClient, now = new Date()): Promise<AdminUpcomingEvent[]> {
  const { data: eventData, error } = await admin
    .from("scheduled_events")
    .select("id, organizer_member_id, title, sport, status, starts_at, ends_at, officials_needed, city, state, zip_code, venue_street")
    .gte("ends_at", now.toISOString())
    .neq("status", "canceled")
    .order("starts_at", { ascending: true })
    .limit(MAX_EVENTS);
  if (error) throw new Error(error.message);
  const events = (eventData as EventRow[] | null) ?? [];
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  type BookingRow = { id: string; event_id: string; ref_member_id: string; offer_id: string | null; status: string };
  type OfferRow = { id: string; event_id: string; ref_member_id: string; status: string; offered_pay: number | null; games_count: number | null };
  type RequestRow = { event_id: string; ref_member_id: string; status: string };

  const [bookings, offers, requests] = await Promise.all([
    rowsIn<BookingRow>(admin, "bookings", "id, event_id, ref_member_id, offer_id, status", "event_id", eventIds),
    rowsIn<OfferRow>(admin, "assignment_offers", "id, event_id, ref_member_id, status, offered_pay, games_count", "event_id", eventIds),
    rowsIn<RequestRow>(admin, "event_signup_requests", "event_id, ref_member_id, status", "event_id", eventIds),
  ]);
  const liveBookings = bookings.filter((b) => b.status !== "canceled");
  const sheets = await rowsIn<{ booking_id: string; status: TimesheetStatus }>(
    admin,
    "booking_timesheets",
    "booking_id, status",
    "booking_id",
    liveBookings.map((b) => b.id)
  );

  const memberIds = [
    ...events.map((e) => e.organizer_member_id),
    ...liveBookings.map((b) => b.ref_member_id),
    ...offers.map((o) => o.ref_member_id),
    ...requests.map((r) => r.ref_member_id),
  ];
  const [members, profiles] = await Promise.all([
    rowsIn<MemberRow>(
      admin,
      "members",
      "id, display_name, first_name, last_name, email, phone, organization_name, is_seed",
      "id",
      memberIds
    ),
    rowsIn<{ member_id: string; gotrefs_id: string | null }>(admin, "ref_profiles", "member_id, gotrefs_id", "member_id", memberIds),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const gotrefsIdBy = new Map(profiles.map((p) => [p.member_id, text(p.gotrefs_id)]));
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const sheetByBooking = new Map(sheets.map((s) => [s.booking_id, s.status]));

  const refEntry = (memberId: string, kind: AdminEventRef["kind"], extra: Partial<AdminEventRef> = {}): AdminEventRef => {
    const m = memberById.get(memberId);
    return {
      memberId,
      name: memberName(m),
      gotrefsId: gotrefsIdBy.get(memberId) ?? "",
      email: text(m?.email),
      phone: text(m?.phone),
      kind,
      timesheetStatus: null,
      games: null,
      pay: null,
      ...extra,
    };
  };

  const result: AdminUpcomingEvent[] = [];
  for (const ev of events) {
    const organizer = memberById.get(ev.organizer_member_id);
    if (organizer?.is_seed === true) continue;

    const refs: AdminEventRef[] = [];
    const seen = new Set<string>();
    for (const b of liveBookings.filter((x) => x.event_id === ev.id)) {
      const offer = b.offer_id ? offerById.get(b.offer_id) : undefined;
      refs.push(
        refEntry(b.ref_member_id, "booked", {
          timesheetStatus: sheetByBooking.get(b.id) ?? null,
          games: offer?.games_count ?? null,
          pay: offer?.offered_pay ?? null,
        })
      );
      seen.add(b.ref_member_id);
    }
    for (const o of offers.filter((x) => x.event_id === ev.id && x.status === "pending")) {
      if (seen.has(o.ref_member_id)) continue;
      refs.push(refEntry(o.ref_member_id, "invited", { games: o.games_count, pay: o.offered_pay }));
      seen.add(o.ref_member_id);
    }
    for (const r of requests.filter((x) => x.event_id === ev.id && (x.status === "pending" || x.status === "queued"))) {
      if (seen.has(r.ref_member_id)) continue;
      refs.push(refEntry(r.ref_member_id, "requested"));
      seen.add(r.ref_member_id);
    }

    const cityLine = [text(ev.city), text(ev.state)].filter(Boolean).join(", ");
    result.push({
      id: ev.id,
      title: text(ev.title) || "Untitled event",
      sport: text(ev.sport),
      status: text(ev.status),
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      place: [text(ev.venue_street), [cityLine, text(ev.zip_code)].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      refsNeeded: Number(ev.officials_needed ?? 0),
      organizer: {
        memberId: ev.organizer_member_id,
        name: memberName(organizer),
        organization: text(organizer?.organization_name),
        email: text(organizer?.email),
        phone: text(organizer?.phone),
      },
      refs,
    });
  }
  return result;
}
