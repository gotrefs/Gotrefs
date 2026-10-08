import { NextResponse, type NextRequest } from "next/server";
import { emailSiteUrl } from "@/lib/email/resend";
import { notifyInBackground, notifyTimesheetSignoff } from "@/lib/email/notifications";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  cleanUnits,
  hoursFromClock,
  needsRefSignoff,
  timesheetMoney,
  unitLabel,
  type Timesheet,
} from "@/lib/timesheets";
import { loadBookingsForTimesheet } from "@/lib/timesheets-server";

export const dynamic = "force-dynamic";

type Body = {
  action?: "check_in" | "clock_out" | "approve" | "dispute";
  /** Games or hours worked, entered by the organizer at clock-out. */
  workedUnits?: number;
  note?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * Timesheet actions for one booking.
 * Organizer: check_in (after scanning the QR), clock_out (with games or hours worked).
 * REF: approve or dispute when the total differs from the booking.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await context.params;
  if (!UUID.test(bookingId)) return fail("Unknown booking.", 404);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("Invalid request.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return fail("Server configuration error.", 503);
  }

  let booking;
  try {
    [booking] = await loadBookingsForTimesheet(admin, { bookingId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load this booking.", 503);
  }
  if (!booking) return fail("Unknown booking.", 404);

  const isOrganizer = booking.organizerMemberId === user.id;
  const isRef = booking.refMemberId === user.id;
  if (!isOrganizer && !isRef) return fail("This isn't your booking.", 403);

  const now = new Date().toISOString();
  const sheet = booking.timesheet;
  const save = async (patch: Partial<Timesheet>) => {
    const { data, error } = await admin
      .from("booking_timesheets")
      .update({ ...patch, updated_at: now })
      .eq("booking_id", bookingId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Timesheet;
  };

  try {
    if (body.action === "check_in") {
      if (!isOrganizer) return fail("Only the organizer checks REFS in.", 403);
      if (sheet?.checked_in_at) return NextResponse.json({ timesheet: sheet });
      if (!booking.inWindow) return fail("Check-in opens 6 hours before the event starts.");
      const { data, error } = await admin
        .from("booking_timesheets")
        .insert({
          booking_id: booking.bookingId,
          event_id: booking.eventId,
          ref_member_id: booking.refMemberId,
          organizer_member_id: booking.organizerMemberId,
          pay_unit: booking.payUnit,
          rate: booking.rate,
          booked_units: booking.bookedUnits,
          checked_in_at: now,
          status: "checked_in",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ timesheet: data });
    }

    if (body.action === "clock_out") {
      if (!isOrganizer) return fail("Only the organizer clocks REFS out.", 403);
      if (!sheet?.checked_in_at) return fail("Check this REF in first.");
      if (sheet.status === "approved") return fail("This timesheet is already approved.");

      const checkedOut = sheet.checked_out_at ?? now;
      const unit = sheet.pay_unit;
      const fromClock = unit === "hour" ? hoursFromClock(sheet.checked_in_at, checkedOut) : null;
      const entered = body.workedUnits === undefined ? null : cleanUnits(body.workedUnits, unit);
      if (body.workedUnits !== undefined && entered === null) return fail(`Enter the ${unit === "hour" ? "hours" : "games"} worked.`);
      if (unit === "game" && entered === null) return fail("Enter how many games this REF worked.");
      const worked = entered ?? fromClock ?? Number(sheet.booked_units);
      const unitsEdited = unit === "hour" ? fromClock !== null && worked !== fromClock : false;

      const next = { worked_units: worked, units_edited: unitsEdited, booked_units: Number(sheet.booked_units) };
      const status = needsRefSignoff(next) ? "awaiting_ref" : "approved";
      const updated = await save({
        checked_out_at: checkedOut,
        worked_units: worked,
        units_edited: unitsEdited,
        status,
        submitted_at: now,
        ref_decided_at: status === "approved" ? now : null,
        dispute_note: null,
      });

      if (status === "awaiting_ref") {
        const m = timesheetMoney(updated);
        const summary = `${unitLabel(unit, m.worked)} worked (booked ${unitLabel(unit, m.booked)})`;
        notifyInBackground(() =>
          notifyTimesheetSignoff({
            admin,
            refMemberId: booking.refMemberId,
            eventTitle: booking.eventTitle,
            summary,
            siteUrl: emailSiteUrl(request.url),
          })
        );
      }
      return NextResponse.json({ timesheet: updated });
    }

    if (body.action === "approve" || body.action === "dispute") {
      if (!isRef) return fail("Only the REF signs off on their timesheet.", 403);
      if (sheet?.status !== "awaiting_ref") return fail("There's nothing to sign off right now.");
      const updated = await save(
        body.action === "approve"
          ? { status: "approved", ref_decided_at: now, dispute_note: null }
          : {
              status: "disputed",
              ref_decided_at: now,
              dispute_note: (body.note ?? "").trim().slice(0, 500) || null,
            }
      );
      return NextResponse.json({ timesheet: updated });
    }

    return fail("Unknown action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the timesheet.";
    return fail(/booking_timesheets/.test(message) ? "Timesheets aren't set up yet." : message, 503);
  }
}
