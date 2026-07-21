import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { sanitizeBoostIds } from "@/lib/boosts";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type EventBody = {
  title?: string;
  sport?: string;
  starts_at?: string;
  ends_at?: string;
  city?: string | null;
  state?: string | null;
  venue_street?: string | null;
  venue_unit?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  zip_code?: string;
  officials_needed?: number;
  pay_offer?: number | null;
  pay_type?: "exact" | "range";
  pay_min?: number | null;
  pay_max?: number | null;
  notes?: string | null;
  boosts?: string[];
};

function parseEventTimes(starts: string, ends: string): { starts_at: string; ends_at: string } | { error: string } {
  const startDate = new Date(starts);
  if (Number.isNaN(startDate.getTime())) {
    return { error: "Invalid start date/time." };
  }
  let endDate = new Date(ends);
  if (Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  }
  return { starts_at: startDate.toISOString(), ends_at: endDate.toISOString() };
}

function isMissingPayRangeColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["pay_type", "pay_min", "pay_max"].some((column) => message.includes(column));
}

function isMissingBoostsColumn(error: { message?: string } | null | undefined) {
  return (error?.message ?? "").includes("boosts");
}

type InsertClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceClient>;

/** Insert the event, retrying without optional columns the DB doesn't have yet. */
async function insertEventRow(client: InsertClient, row: Record<string, unknown>) {
  let attempt = { ...row };
  for (let i = 0; i < 3; i++) {
    const { data, error } = await client.from("scheduled_events").insert(attempt).select("id").single();
    if (!error) return { data, error };
    let stripped = false;
    if (isMissingBoostsColumn(error) && "boosts" in attempt) {
      attempt = { ...attempt };
      delete attempt.boosts;
      stripped = true;
    } else if (isMissingPayRangeColumn(error) && "pay_type" in attempt) {
      attempt = { ...attempt };
      delete attempt.pay_type;
      delete attempt.pay_min;
      delete attempt.pay_max;
      stripped = true;
    } else if (
      (error.message ?? "").includes("venue_street") ||
      (error.message ?? "").includes("venue_unit") ||
      (error.message ?? "").includes("venue_lat") ||
      (error.message ?? "").includes("venue_lng")
    ) {
      attempt = { ...attempt };
      delete attempt.venue_street;
      delete attempt.venue_unit;
      delete attempt.venue_lat;
      delete attempt.venue_lng;
      stripped = true;
    }
    if (!stripped) return { data, error };
  }
  return client.from("scheduled_events").insert(attempt).select("id").single();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const zip = (body.zip_code ?? "").trim();
  if (!body.starts_at || !zip) {
    return NextResponse.json({ error: "Start time and ZIP are required." }, { status: 400 });
  }

  const times = parseEventTimes(body.starts_at, body.ends_at ?? body.starts_at);
  if ("error" in times) {
    return NextResponse.json({ error: times.error }, { status: 400 });
  }

  const needed = Math.max(1, Number(body.officials_needed) || 1);
  const payRaw = body.pay_offer;
  const payNum = payRaw == null || payRaw === ("" as unknown as number) ? null : Number(payRaw);
  const payOffer = payNum != null && Number.isFinite(payNum) ? payNum : null;
  const payType = body.pay_type === "range" ? "range" : "exact";
  const payMinRaw = body.pay_min;
  const payMaxRaw = body.pay_max;
  const payMinNum = payMinRaw == null || payMinRaw === ("" as unknown as number) ? null : Number(payMinRaw);
  const payMaxNum = payMaxRaw == null || payMaxRaw === ("" as unknown as number) ? null : Number(payMaxRaw);
  const venueLatRaw = body.venue_lat;
  const venueLngRaw = body.venue_lng;
  const venueLat =
    venueLatRaw == null || venueLatRaw === ("" as unknown as number) ? null : Number(venueLatRaw);
  const venueLng =
    venueLngRaw == null || venueLngRaw === ("" as unknown as number) ? null : Number(venueLngRaw);

  const row = {
    organizer_member_id: user.id,
    title: (body.title ?? "").trim() || "Event",
    sport: (body.sport ?? "").trim() || "Basketball",
    starts_at: times.starts_at,
    ends_at: times.ends_at,
    city: body.city?.trim() || null,
    state: body.state?.trim() || null,
    venue_street: body.venue_street?.trim() || null,
    venue_unit: body.venue_unit?.trim() || null,
    venue_lat: venueLat != null && Number.isFinite(venueLat) ? venueLat : null,
    venue_lng: venueLng != null && Number.isFinite(venueLng) ? venueLng : null,
    zip_code: zip,
    officials_needed: needed,
    pay_offer: payType === "range" && Number.isFinite(payMinNum as number) ? payMinNum : payOffer,
    pay_type: payType,
    pay_min: payType === "range" && Number.isFinite(payMinNum as number) ? payMinNum : null,
    pay_max: payType === "range" && Number.isFinite(payMaxNum as number) ? payMaxNum : null,
    notes: body.notes?.trim() || null,
    boosts: sanitizeBoostIds(body.boosts),
    status: "published" as const,
  };

  let admin;
  try {
    admin = createServiceClient();
    const sync = await syncMemberAccount(admin, user);
    if (sync.role !== "organizer") {
      return NextResponse.json(
        { error: "Only event organizers can publish events. Sign up or log in as an organizer." },
        { status: 403 }
      );
    }
    const { data, error } = await insertEventRow(admin, row);
    if (error || !data) {
      console.error("[api/events]", error?.message ?? "No event id returned.");
      return NextResponse.json({ error: error?.message ?? "Could not create event." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch {
    const { data, error } = await insertEventRow(supabase, row);
    if (error || !data) {
      console.error("[api/events] client insert:", error?.message ?? "No event id returned.");
      return NextResponse.json(
        {
          error:
            error?.message.includes("row-level security") || error?.code === "42501"
              ? "Permission denied. Your account may not be set up as an organizer — log out and sign in again as an event organizer."
              : error?.message ?? "Could not create event.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, id: data.id });
  }
}
