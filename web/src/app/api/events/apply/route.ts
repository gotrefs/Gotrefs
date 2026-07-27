import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { isQueuedSignupHold } from "@/lib/activate-queued-signups";
import { notifyInBackground, notifyOrganizerNewApplication } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { refCanApplyToGames } from "@/lib/ref-eligibility";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ApplyBody = {
  eventId?: string;
};

export const APPLY_REQUIRES_APPROVAL_MESSAGE =
  "GotRefs must approve your verification before you can request to work games.";

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

  const eligible = refCanApplyToGames({
    screeningStatus: screening?.status,
    verificationMethod: profile?.verification_method,
    externalProofPath: profile?.external_verification_proof_path,
    verificationSubmissionStatus: submission?.status,
  });

  const { data: event, error: eventError } = await admin
    .from("scheduled_events")
    .select("id, title, status, city, state, zip_code, starts_at, ends_at")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.status !== "published") {
    return NextResponse.json({ error: "This event is no longer available for applications." }, { status: 404 });
  }

  const eventEnd = new Date(event.ends_at || event.starts_at);
  if (!Number.isNaN(eventEnd.getTime()) && eventEnd.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This game has already ended, so requests are closed." },
      { status: 400 }
    );
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
      status: held ? APPLY_REQUIRES_APPROVAL_MESSAGE : undefined,
    });
  }

  if (existing?.status === "accepted") {
    return NextResponse.json(
      { error: "You're already approved for this game — check Trips → Upcoming." },
      { status: 400 }
    );
  }

  if (existing?.status === "declined") {
    return NextResponse.json(
      { error: "This game is no longer available for you to request." },
      { status: 400 }
    );
  }

  // withdrawn (or no row) → only fully approved refs may create a new request.
  if (!eligible) {
    return NextResponse.json({ error: APPLY_REQUIRES_APPROVAL_MESSAGE }, { status: 403 });
  }

  const { data: upserted, error: upsertError } = await admin
    .from("event_signup_requests")
    .upsert(
      {
        event_id: eventId,
        ref_member_id: refMemberId,
        status: "pending",
        message: "Ref applied from the open games marketplace",
      },
      { onConflict: "event_id,ref_member_id" }
    )
    .select("id")
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  notifyInBackground(() =>
    notifyOrganizerNewApplication({
      admin,
      eventId,
      refMemberId,
      applicationId: upserted?.id,
      siteUrl: emailSiteUrl(request.url),
    })
  );

  return NextResponse.json({
    ok: true,
    eventTitle,
    applicationId: upserted?.id ?? null,
    pendingVerification: false,
    queuedStatus: "pending",
  });
}
