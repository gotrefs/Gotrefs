import { NextResponse, type NextRequest } from "next/server";
import { isQueuedSignupHold } from "@/lib/activate-queued-signups";
import { boostedOfferPay, computeOfferBoost } from "@/lib/boosts-server";
import { notifyApplicationDecision, notifyInBackground } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { isOrganizerMember } from "@/lib/organizer-access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Body = { action?: "accept" | "decline" };

type EventJoin = {
  organizer_member_id: string;
  pay_offer?: number | null;
  starts_at?: string | null;
  boosts?: string[] | null;
  officials_needed?: number | null;
};

function eventFromJoin(value: EventJoin | EventJoin[] | null | undefined): EventJoin | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

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

  const canManage = await isOrganizerMember(supabase, user);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "accept" && body.action !== "decline") {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  let { data: row, error } = await admin
    .from("event_signup_requests")
    .select(
      "id, event_id, ref_member_id, status, message, scheduled_events!inner ( organizer_member_id, pay_offer, starts_at, boosts, officials_needed )"
    )
    .eq("id", id)
    .maybeSingle();

  if (error && /boosts|officials_needed/.test(error.message ?? "")) {
    const retry = await admin
      .from("event_signup_requests")
      .select(
        "id, event_id, ref_member_id, status, message, scheduled_events!inner ( organizer_member_id, pay_offer, starts_at )"
      )
      .eq("id", id)
      .maybeSingle();
    row = retry.data as typeof row;
    error = retry.error;
  }

  if (error || !row) {
    return NextResponse.json({ error: error?.message || "Application not found" }, { status: 404 });
  }

  const event = eventFromJoin(row.scheduled_events as EventJoin | EventJoin[] | null);
  if (event?.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Idempotent: already decided requests still return success so the UI can close cleanly.
  if (row.status === "accepted" || row.status === "declined") {
    return NextResponse.json({ ok: true, status: row.status, alreadyDecided: true });
  }

  if (row.status !== "pending" || isQueuedSignupHold(row)) {
    return NextResponse.json(
      {
        error: isQueuedSignupHold(row)
          ? "This request is still awaiting GotREFS verification."
          : "This application was already decided.",
      },
      { status: 400 }
    );
  }

  if (body.action === "decline") {
    const { error: updateError } = await admin
      .from("event_signup_requests")
      .update({ status: "declined" })
      .eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    notifyInBackground(() =>
      notifyApplicationDecision({
        admin,
        refMemberId: row.ref_member_id,
        eventId: row.event_id,
        accepted: false,
        applicationId: row.id,
        siteUrl: emailSiteUrl(request.url),
      })
    );
    return NextResponse.json({ ok: true, status: "declined" });
  }

  const basePay = event?.pay_offer ?? null;
  const boost = await computeOfferBoost(admin, {
    organizerMemberId: user.id,
    refMemberId: row.ref_member_id,
    eventStartsAt: event?.starts_at ?? null,
    eventBoosts: event?.boosts ?? [],
  });

  // Ensure eligibility trigger can pass when accepting the offer.
  const { error: screeningError } = await admin.from("screening_checks").upsert(
    {
      ref_member_id: row.ref_member_id,
      status: "clear",
      summary: "Eligible via organizer-approved game request",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ref_member_id" }
  );
  if (screeningError) {
    return NextResponse.json({ error: screeningError.message }, { status: 400 });
  }

  const { data: existingOffer } = await admin
    .from("assignment_offers")
    .select("id, status")
    .eq("event_id", row.event_id)
    .eq("ref_member_id", row.ref_member_id)
    .maybeSingle();

  const { data: existingBooking } = await admin
    .from("bookings")
    .select("id, offer_id, status")
    .eq("event_id", row.event_id)
    .eq("ref_member_id", row.ref_member_id)
    .maybeSingle();

  const approvalMessage = "Organizer approved your request — see Upcoming games for the full address.";
  let offerId = existingOffer?.id ?? existingBooking?.offer_id ?? null;

  // Never reset an accepted offer back to pending (that breaks booking uniqueness).
  if (existingBooking || existingOffer?.status === "accepted") {
    if (offerId && existingOffer?.status !== "accepted") {
      await admin
        .from("assignment_offers")
        .update({
          status: "accepted",
          message: approvalMessage,
          offered_pay: boostedOfferPay(basePay, boost.percent),
        })
        .eq("id", offerId);
    } else if (offerId) {
      await admin
        .from("assignment_offers")
        .update({
          message: approvalMessage,
          offered_pay: boostedOfferPay(basePay, boost.percent),
        })
        .eq("id", offerId);
    }
  } else if (existingOffer?.id) {
    const { error: acceptOfferError } = await admin
      .from("assignment_offers")
      .update({
        status: "accepted",
        message: approvalMessage,
        offered_pay: boostedOfferPay(basePay, boost.percent),
      })
      .eq("id", existingOffer.id);

    if (acceptOfferError) {
      // Booking may already exist from a prior partial accept.
      if (!/duplicate key|already exists|fully staffed/i.test(acceptOfferError.message)) {
        return NextResponse.json({ error: acceptOfferError.message }, { status: 400 });
      }
    }
    offerId = existingOffer.id;
  } else {
    const offerPayload = {
      event_id: row.event_id,
      ref_member_id: row.ref_member_id,
      offered_pay: boostedOfferPay(basePay, boost.percent),
      base_pay: basePay,
      boost_percent: boost.percent,
      message: approvalMessage,
      status: "pending" as const,
    };

    let { data: offerRow, error: offerError } = await admin
      .from("assignment_offers")
      .insert(offerPayload)
      .select("id, status")
      .maybeSingle();

    if (offerError && /boost_percent|base_pay/.test(offerError.message ?? "")) {
      const withoutBoost = {
        event_id: offerPayload.event_id,
        ref_member_id: offerPayload.ref_member_id,
        offered_pay: offerPayload.offered_pay,
        message: offerPayload.message,
        status: offerPayload.status,
      };
      const retry = await admin.from("assignment_offers").insert(withoutBoost).select("id, status").maybeSingle();
      offerRow = retry.data;
      offerError = retry.error;
    }

    if (offerError) {
      return NextResponse.json({ error: offerError.message }, { status: 400 });
    }
    if (!offerRow?.id) {
      return NextResponse.json({ error: "Could not create assignment for this request." }, { status: 400 });
    }

    offerId = offerRow.id;
    const { error: acceptOfferError } = await admin
      .from("assignment_offers")
      .update({ status: "accepted" })
      .eq("id", offerId);

    if (acceptOfferError) {
      if (!/duplicate key|already exists|fully staffed/i.test(acceptOfferError.message)) {
        return NextResponse.json({ error: acceptOfferError.message }, { status: 400 });
      }
    }
  }

  // Ensure a booking exists even if the DB trigger only runs on UPDATE and was skipped.
  if (offerId) {
    const { data: bookingCheck } = await admin
      .from("bookings")
      .select("id")
      .eq("offer_id", offerId)
      .maybeSingle();

    if (!bookingCheck) {
      const { count: bookedCount } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_id", row.event_id)
        .in("status", ["confirmed", "completed"]);

      const needed = event?.officials_needed ?? 1;
      if ((bookedCount ?? 0) < needed) {
        await admin.from("bookings").upsert(
          {
            offer_id: offerId,
            event_id: row.event_id,
            ref_member_id: row.ref_member_id,
            organizer_member_id: user.id,
            status: "confirmed",
          },
          { onConflict: "offer_id", ignoreDuplicates: true }
        );
      }
    }
  }

  const { error: acceptError } = await admin
    .from("event_signup_requests")
    .update({ status: "accepted" })
    .eq("id", id);
  if (acceptError) return NextResponse.json({ error: acceptError.message }, { status: 400 });

  notifyInBackground(() =>
    notifyApplicationDecision({
      admin,
      refMemberId: row.ref_member_id,
      eventId: row.event_id,
      accepted: true,
      applicationId: row.id,
      siteUrl: emailSiteUrl(request.url),
    })
  );

  return NextResponse.json({ ok: true, status: "accepted", offerId });
}
