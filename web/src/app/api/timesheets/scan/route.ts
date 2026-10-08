import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadBookingsForTimesheet } from "@/lib/timesheets-server";

export const dynamic = "force-dynamic";

/**
 * After an organizer scans a REF's QR code: the bookings they have with that REF,
 * so the card page can offer Check in / Clock out. Anyone else gets an empty list.
 */
export async function GET(request: NextRequest) {
  const gotrefsId = (new URL(request.url).searchParams.get("gotrefsId") ?? "").trim().toUpperCase();
  const empty = NextResponse.json({ bookings: [] }, { headers: { "Cache-Control": "no-store" } });
  if (!/^GR-[A-Z0-9-]{3,20}$/.test(gotrefsId)) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  try {
    const admin = createServiceClient();
    const { data: profile } = await admin
      .from("ref_profiles")
      .select("member_id")
      .ilike("gotrefs_id", gotrefsId)
      .maybeSingle();
    if (!profile?.member_id) return empty;

    const bookings = await loadBookingsForTimesheet(admin, {
      organizerMemberId: user.id,
      refMemberId: profile.member_id,
    });
    // Today's games (or one still open on the clock), soonest first.
    const relevant = bookings
      .filter((b) => b.inWindow || b.timesheet?.status === "checked_in")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return NextResponse.json({ bookings: relevant }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load this booking.";
    return NextResponse.json({ error: message, bookings: [] }, { status: 503 });
  }
}
