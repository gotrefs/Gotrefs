import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refCanApplyToEvents } from "@/lib/ref-eligibility";

type ApplyBody = {
  eventId?: string;
};

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

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const sync = await syncMemberAccount(admin, user);
  if (sync.role !== "ref") {
    return NextResponse.json({ error: "Only referees can apply to work events." }, { status: 403 });
  }

  const { data: submission } = await admin
    .from("ref_verification_submissions")
    .select("status, rejection_reason")
    .eq("ref_member_id", user.id)
    .maybeSingle();

  if (!refCanApplyToEvents(submission?.status)) {
    const message =
      submission?.status === "rejected" && submission.rejection_reason
        ? `Verification was denied: ${submission.rejection_reason} Update your documents and resubmit for review.`
        : submission?.status === "submitted" || submission?.status === "under_review"
          ? "Your verification is under review. You can apply to events after approval."
          : "Complete and submit your verification package before applying to events.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const { data: event, error: eventError } = await admin
    .from("scheduled_events")
    .select("id, title, status")
    .eq("id", body.eventId)
    .single();

  if (eventError || !event || event.status !== "published") {
    return NextResponse.json({ error: "This event is not available for applications." }, { status: 404 });
  }

  const { error } = await admin.from("event_signup_requests").upsert(
    {
      event_id: event.id,
      ref_member_id: user.id,
      status: "pending",
      message: "Ref applied from the open games calendar",
    },
    { onConflict: "event_id,ref_member_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, eventTitle: event.title });
}
