import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";
import { depositRefundableCents } from "@/lib/stripe/charge-organizer-for-offer";

/**
 * Admin queue: event deposits still held / partially used with refundable balance.
 * Cron refunds after event end; this is GotREFS visibility into who is owed money back.
 */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: deposits, error } = await admin
    .from("event_deposits")
    .select(
      "id, event_id, organizer_member_id, required_cents, collected_cents, applied_cents, refunded_cents, status, updated_at, refunded_at"
    )
    .in("status", ["held", "partially_used", "pending"])
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    if (/event_deposits|does not exist/i.test(error.message)) {
      return NextResponse.json({ deposits: [], note: "event_deposits table not available." });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (deposits ?? []).filter((row) => depositRefundableCents(row) > 0);
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const organizerIds = [...new Set(rows.map((r) => r.organizer_member_id))];

  const [{ data: events }, { data: members }] = await Promise.all([
    eventIds.length
      ? admin
          .from("scheduled_events")
          .select("id, title, sport, starts_at, ends_at")
          .in("id", eventIds)
      : Promise.resolve({ data: [] as Array<{
          id: string;
          title: string;
          sport: string;
          starts_at: string;
          ends_at: string | null;
        }> }),
    organizerIds.length
      ? admin.from("members").select("id, display_name, email").in("id", organizerIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; display_name: string | null; email?: string | null }>,
        }),
  ]);

  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));
  const now = Date.now();

  const payload = rows.map((row) => {
    const event = eventMap.get(row.event_id);
    const org = memberMap.get(row.organizer_member_id);
    const refundableCents = depositRefundableCents(row);
    const endsAt = event?.ends_at ?? null;
    const eventEnded = endsAt != null && new Date(endsAt).getTime() <= now;
    return {
      id: row.id,
      eventId: row.event_id,
      eventTitle: event?.title ?? "Event",
      sport: event?.sport ?? null,
      startsAt: event?.starts_at ?? null,
      endsAt,
      eventEnded,
      organizerMemberId: row.organizer_member_id,
      organizerName: org?.display_name?.trim() || "Organizer",
      organizerEmail: org?.email ?? null,
      status: row.status,
      requiredCents: row.required_cents,
      collectedCents: row.collected_cents,
      appliedCents: row.applied_cents,
      refundedCents: row.refunded_cents,
      refundableCents,
      refundReady: eventEnded && refundableCents > 0,
      updatedAt: row.updated_at,
    };
  });

  payload.sort((a, b) => {
    if (a.refundReady !== b.refundReady) return a.refundReady ? -1 : 1;
    return (b.endsAt || "").localeCompare(a.endsAt || "");
  });

  return NextResponse.json({
    deposits: payload,
    note: "Unused deposits refund via Stripe after the event ends (daily cron) or when the organizer taps Refund deposit. Refund-ready rows are owed money back now.",
  });
}
