import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyInBackground, notifyOrganizerNewApplication } from "@/lib/email/notifications";

/** Marker stored on event_signup_requests.message when status=pending is used as a queue hold. */
export const QUEUED_PENDING_VERIFICATION_MESSAGE =
  "__queued_pending_verification__";

export function isQueuedSignupHold(row: { status?: string | null; message?: string | null }): boolean {
  if (row.status === "queued") return true;
  return (
    row.status === "pending" &&
    (row.message ?? "").startsWith(QUEUED_PENDING_VERIFICATION_MESSAGE)
  );
}

/**
 * When a ref becomes verification-approved, activate any game requests they
 * queued while pending and email each event organizer.
 */
export async function activateQueuedSignupRequests(opts: {
  admin: SupabaseClient;
  refMemberId: string;
  siteUrl?: string;
}): Promise<{ activated: number }> {
  const { data: rows, error } = await opts.admin
    .from("event_signup_requests")
    .select("id, event_id, status, message")
    .eq("ref_member_id", opts.refMemberId)
    .in("status", ["queued", "pending"]);

  if (error || !rows?.length) {
    return { activated: 0 };
  }

  const held = rows.filter((row) => isQueuedSignupHold(row));
  let activated = 0;

  for (const row of held) {
    const { error: updateError } = await opts.admin
      .from("event_signup_requests")
      .update({
        status: "pending",
        message: "Ref applied — verification approved; request released to organizer",
      })
      .eq("id", row.id);

    if (updateError) continue;
    activated += 1;

    notifyInBackground(() =>
      notifyOrganizerNewApplication({
        admin: opts.admin,
        eventId: row.event_id,
        refMemberId: opts.refMemberId,
        applicationId: row.id,
        siteUrl: opts.siteUrl,
      })
    );
  }

  return { activated };
}
