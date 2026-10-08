import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkInWindowOpen, type PayUnit, type Timesheet } from "@/lib/timesheets";

/** One booking as the check-in screens need it. */
export type BookingForTimesheet = {
  bookingId: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string;
  refMemberId: string;
  organizerMemberId: string;
  refName: string;
  payUnit: PayUnit;
  rate: number | null;
  bookedUnits: number;
  inWindow: boolean;
  timesheet: Timesheet | null;
};

type BookingRow = {
  id: string;
  event_id: string;
  ref_member_id: string;
  organizer_member_id: string;
  offer_id: string;
  status: string;
  scheduled_events: { title: string | null; starts_at: string; ends_at: string } | { title: string | null; starts_at: string; ends_at: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Bookings (with their offer, REF rate unit and timesheet) by id or for an organizer + REF pair. */
export async function loadBookingsForTimesheet(
  admin: SupabaseClient,
  filter: { bookingId: string } | { organizerMemberId: string; refMemberId: string }
): Promise<BookingForTimesheet[]> {
  let query = admin
    .from("bookings")
    .select("id, event_id, ref_member_id, organizer_member_id, offer_id, status, scheduled_events ( title, starts_at, ends_at )")
    .in("status", ["confirmed", "completed"]);
  query =
    "bookingId" in filter
      ? query.eq("id", filter.bookingId)
      : query.eq("organizer_member_id", filter.organizerMemberId).eq("ref_member_id", filter.refMemberId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const bookings = (data ?? []) as BookingRow[];
  if (bookings.length === 0) return [];

  const offerIds = bookings.map((b) => b.offer_id);
  const refIds = [...new Set(bookings.map((b) => b.ref_member_id))];
  const [offersRes, sheetsRes, profilesRes, membersRes] = await Promise.all([
    admin.from("assignment_offers").select("*").in("id", offerIds),
    admin.from("booking_timesheets").select("*").in("booking_id", bookings.map((b) => b.id)),
    admin.from("ref_profiles").select("member_id, rate_unit").in("member_id", refIds),
    admin.from("members").select("id, display_name, first_name, last_name").in("id", refIds),
  ]);
  if (sheetsRes.error && /booking_timesheets/.test(sheetsRes.error.message)) {
    throw new Error("Timesheets aren't set up yet: run the booking_timesheets SQL in Supabase.");
  }
  const offerById = new Map((offersRes.data ?? []).map((o: Record<string, unknown>) => [o.id as string, o]));
  const sheetByBooking = new Map((sheetsRes.data ?? []).map((t: Timesheet) => [t.booking_id, t]));
  const unitByRef = new Map((profilesRes.data ?? []).map((p: { member_id: string; rate_unit: string | null }) => [p.member_id, p.rate_unit]));
  const nameByRef = new Map(
    (membersRes.data ?? []).map((m: { id: string; display_name: string | null; first_name?: string | null; last_name?: string | null }) => {
      const first = (m.first_name ?? "").trim() || (m.display_name ?? "").trim().split(/\s+/)[0] || "REF";
      const last = (m.last_name ?? "").trim() || (m.display_name ?? "").trim().split(/\s+/).slice(1).join(" ");
      return [m.id, last ? `${first} ${last[0].toUpperCase()}.` : first];
    })
  );

  return bookings.flatMap((b) => {
    const ev = one(b.scheduled_events);
    if (!ev) return [];
    const offer = offerById.get(b.offer_id) ?? {};
    const rate = Number(offer.offered_pay);
    const games = Number(offer.games_count);
    return [
      {
        bookingId: b.id,
        eventId: b.event_id,
        eventTitle: ev.title?.trim() || "Event",
        startsAt: ev.starts_at,
        endsAt: ev.ends_at,
        refMemberId: b.ref_member_id,
        organizerMemberId: b.organizer_member_id,
        refName: nameByRef.get(b.ref_member_id) ?? "REF",
        payUnit: unitByRef.get(b.ref_member_id) === "hour" ? "hour" : "game",
        rate: Number.isFinite(rate) ? rate : null,
        bookedUnits: Number.isFinite(games) && games > 0 ? games : 1,
        inWindow: checkInWindowOpen(ev),
        timesheet: sheetByBooking.get(b.id) ?? null,
      },
    ];
  });
}
