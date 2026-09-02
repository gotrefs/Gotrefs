import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyPayoutMethodNeeded } from "@/lib/email/notifications";
import { emailSiteUrl } from "@/lib/email/resend";
import { connectReadyForPayout, type ConnectAccountRow } from "@/lib/stripe/connect";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function payoutSetupNudgeDueAt(from = new Date()) {
  return new Date(from.getTime() + ONE_DAY_MS).toISOString();
}

/** Schedule the day-after-signup payout setup email (no-op if already scheduled/sent or columns missing). */
export async function schedulePayoutSetupNudge(admin: SupabaseClient, memberId: string) {
  const { data: existing, error: readError } = await admin
    .from("ref_profiles")
    .select("payout_setup_nudge_due_at, payout_setup_nudge_sent_at")
    .eq("member_id", memberId)
    .maybeSingle();

  if (readError) {
    if (!/payout_setup_nudge/i.test(readError.message)) {
      console.warn("[payout-nudge] schedule read failed:", readError.message);
    }
    return;
  }
  if (existing?.payout_setup_nudge_sent_at || existing?.payout_setup_nudge_due_at) return;

  const dueAt = payoutSetupNudgeDueAt();
  const { error } = await admin
    .from("ref_profiles")
    .update({
      payout_setup_nudge_due_at: dueAt,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", memberId);

  if (error && !/payout_setup_nudge/i.test(error.message)) {
    console.warn("[payout-nudge] schedule failed:", error.message);
  }
}

/**
 * Send due payout-setup nudges for refs who still need Stripe Connect / W-9.
 * Safe to call from cron or the referee dashboard.
 */
export async function processDuePayoutSetupNudges(
  admin: SupabaseClient,
  opts?: { onlyMemberId?: string; limit?: number }
) {
  const nowIso = new Date().toISOString();
  let query = admin
    .from("ref_profiles")
    .select("member_id, payout_setup_nudge_due_at, payout_setup_nudge_sent_at")
    .is("payout_setup_nudge_sent_at", null)
    .not("payout_setup_nudge_due_at", "is", null)
    .lte("payout_setup_nudge_due_at", nowIso)
    .limit(opts?.limit ?? 50);

  if (opts?.onlyMemberId) {
    query = query.eq("member_id", opts.onlyMemberId);
  }

  const { data: rows, error } = await query;
  if (error) {
    if (/payout_setup_nudge/i.test(error.message)) {
      return { sent: 0, skipped: 0, error: "migration_required" as const };
    }
    return { sent: 0, skipped: 0, error: error.message };
  }

  let sent = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const memberId = row.member_id as string;
    const { data: connect } = await admin
      .from("stripe_connect_accounts")
      .select("*")
      .eq("member_id", memberId)
      .maybeSingle();

    const ready = connectReadyForPayout((connect as ConnectAccountRow | null) ?? null);
    if (ready.ok) {
      await admin
        .from("ref_profiles")
        .update({
          payout_setup_nudge_sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq("member_id", memberId);
      skipped += 1;
      continue;
    }

    const ok = await notifyPayoutMethodNeeded({
      admin,
      refMemberId: memberId,
      reason: ready.reason === "pending_tax" ? "pending_tax" : "setup_nudge",
      siteUrl: emailSiteUrl(),
    });

    await admin
      .from("ref_profiles")
      .update({
        payout_setup_nudge_sent_at: nowIso,
        updated_at: nowIso,
      })
      .eq("member_id", memberId);

    if (ok) sent += 1;
    else skipped += 1;
  }

  return { sent, skipped };
}
