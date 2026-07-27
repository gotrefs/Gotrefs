import { NextResponse, type NextRequest } from "next/server";
import { isQueuedSignupHold } from "@/lib/activate-queued-signups";
import {
  notifyApplicationWithdrawnToOrganizer,
  notifyApplicationWithdrawnToRef,
} from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Body = { action?: "withdraw" };

type EventJoin = { organizer_member_id: string };

function eventFromJoin(value: EventJoin | EventJoin[] | null | undefined): EventJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function canWithdrawStatus(status: string, message: string | null | undefined) {
  if (status === "pending" || status === "queued") return true;
  // Legacy queued hold stored as pending + marker message.
  return status === "pending" && isQueuedSignupHold({ status, message });
}

/**
 * Withdraw a pending/queued game application.
 * Caller must be the referee on the row or the event organizer.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "withdraw") {
    return NextResponse.json({ error: "action must be withdraw" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from("event_signup_requests")
    .select(
      "id, event_id, ref_member_id, status, message, scheduled_events!inner ( organizer_member_id )"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "Application not found" }, { status: 404 });
  }

  const event = eventFromJoin(row.scheduled_events as EventJoin | EventJoin[] | null);
  const isRef = row.ref_member_id === user.id;
  const isOrg = event?.organizer_member_id === user.id;
  if (!isRef && !isOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.status === "withdrawn") {
    return NextResponse.json({ ok: true, status: "withdrawn", alreadyWithdrawn: true });
  }

  if (!canWithdrawStatus(row.status, row.message)) {
    return NextResponse.json(
      {
        error:
          row.status === "accepted"
            ? "This request was already accepted. Cancel the booking/offer instead."
            : "This application can no longer be unrequested.",
      },
      { status: 400 }
    );
  }

  const { error: updateError } = await admin
    .from("event_signup_requests")
    .update({ status: "withdrawn" })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const siteUrl = emailSiteUrl(request.url);
  try {
    if (isRef) {
      const sent = await notifyApplicationWithdrawnToOrganizer({
        admin,
        eventId: row.event_id,
        refMemberId: row.ref_member_id,
        applicationId: row.id,
        siteUrl,
      });
      if (!sent) console.warn("[applications/withdraw] organizer cancel email not sent", row.id);
    } else {
      const sent = await notifyApplicationWithdrawnToRef({
        admin,
        eventId: row.event_id,
        refMemberId: row.ref_member_id,
        applicationId: row.id,
        siteUrl,
      });
      if (!sent) console.warn("[applications/withdraw] ref cancel email not sent", row.id);
    }
  } catch (err) {
    console.error("[applications/withdraw] email failed", err);
  }

  return NextResponse.json({ ok: true, status: "withdrawn", by: isRef ? "ref" : "organizer" });
}
