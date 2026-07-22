import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import {
  QUEUED_PENDING_VERIFICATION_MESSAGE,
  isQueuedSignupHold,
} from "@/lib/activate-queued-signups";
import { notifyInBackground, notifyOrganizerNewApplication } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { refOfferEligible } from "@/lib/ref-eligibility";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ApplyBody = {
  eventId?: string;
};

const PENDING_STATUS_MESSAGE =
  "Your status is pending — once GotREFS approves your verification, the organizer will be notified automatically for this game.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  let admin: ReturnType<typeof createServiceClient>;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const sync = await syncMemberAccount(admin, user);
  if (sync.role !== "ref") {
    return NextResponse.json({ error: "Only referees can apply to work events." }, { status: 403 });
  }

  const [{ data: profile }, { data: submission }, { data: screening }] = await Promise.all([
    admin
      .from("ref_profiles")
      .select("verification_method, external_verification_proof_path")
      .eq("member_id", user.id)
      .maybeSingle(),
    admin.from("ref_verification_submissions").select("status").eq("ref_member_id", user.id).maybeSingle(),
    admin.from("screening_checks").select("status").eq("ref_member_id", user.id).maybeSingle(),
  ]);

  const eligible = refOfferEligible({
    screeningStatus: screening?.status,
    verificationMethod: profile?.verification_method,
    externalProofPath: profile?.external_verification_proof_path,
    verificationSubmissionStatus: submission?.status,
  });

  // Eligible refs go straight to the organizer. Everyone else can still apply —
  // the request is queued until GotREFS admin approval, then organizers are emailed.
  const queueUntilApproved = !eligible;

  const { data: event, error: eventError } = await admin
    .from("scheduled_events")
    .select("id, title, status, city, state, zip_code, starts_at")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.status !== "published") {
    return NextResponse.json({ error: "This event is not available for applications." }, { status: 404 });
  }

  const eventId = event.id;
  const eventTitle = event.title;
  const refMemberId = user.id;

  const { data: existing } = await admin
    .from("event_signup_requests")
    .select("id, status, message")
    .eq("event_id", eventId)
    .eq("ref_member_id", refMemberId)
    .maybeSingle();

  if (existing && (existing.status === "pending" || existing.status === "queued")) {
    const held = isQueuedSignupHold(existing);
    return NextResponse.json({
      ok: true,
      eventTitle,
      applicationId: existing.id,
      alreadyRequested: true,
      pendingVerification: held,
      status: held ? PENDING_STATUS_MESSAGE : undefined,
    });
  }

  if (existing?.status === "accepted") {
    return NextResponse.json(
      { error: "You're already approved for this game — check Trips → Upcoming." },
      { status: 400 }
    );
  }

  if (existing?.status === "declined" || existing?.status === "withdrawn") {
    return NextResponse.json(
      { error: "This game is no longer available for you to request." },
      { status: 400 }
    );
  }

  async function upsertRequest(status: "queued" | "pending", message: string) {
    return admin
      .from("event_signup_requests")
      .upsert(
        {
          event_id: eventId,
          ref_member_id: refMemberId,
          status,
          message,
        },
        { onConflict: "event_id,ref_member_id" }
      )
      .select("id")
      .single();
  }

  let upserted: { id: string } | null = null;
  let usedQueuedStatus = false;

  if (queueUntilApproved) {
    const queuedTry = await upsertRequest(
      "queued",
      "Ref requested while verification pending — held until GotREFS approval"
    );
    if (queuedTry.error && /queued|check|constraint/i.test(queuedTry.error.message)) {
      // DB migration not applied yet — hold as pending with a marker organizers filter out.
      const fallback = await upsertRequest("pending", QUEUED_PENDING_VERIFICATION_MESSAGE);
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 400 });
      }
      upserted = fallback.data;
    } else if (queuedTry.error) {
      return NextResponse.json({ error: queuedTry.error.message }, { status: 400 });
    } else {
      upserted = queuedTry.data;
      usedQueuedStatus = true;
    }
  } else {
    const live = await upsertRequest("pending", "Ref applied from the open games marketplace");
    if (live.error) {
      return NextResponse.json({ error: live.error.message }, { status: 400 });
    }
    upserted = live.data;
  }

  if (!queueUntilApproved) {
    notifyInBackground(() =>
      notifyOrganizerNewApplication({
        admin,
        eventId,
        refMemberId,
        applicationId: upserted?.id,
        siteUrl: emailSiteUrl(request.url),
      })
    );
  }

  return NextResponse.json({
    ok: true,
    eventTitle,
    applicationId: upserted?.id ?? null,
    pendingVerification: queueUntilApproved,
    queuedStatus: usedQueuedStatus ? "queued" : queueUntilApproved ? "pending_hold" : "pending",
    status: queueUntilApproved ? PENDING_STATUS_MESSAGE : undefined,
  });
}
