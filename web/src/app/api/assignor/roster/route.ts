import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type RosterBody = {
  display_name?: string;
  primary_sport?: string;
  additional_sports?: string[];
  certification_level?: string;
  rate_per_game?: number | null;
  availability?: { start_at: string; end_at: string }[];
  notes?: string;
  contact_email?: string;
};

async function requireAssignor(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("ref_profiles")
    .select("is_assignor")
    .eq("member_id", userId)
    .maybeSingle();
  return Boolean(data?.is_assignor);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data, error } = await supabase
    .from("assignor_roster_entries")
    .select(
      "id, display_name, primary_sport, additional_sports, certification_level, rate_per_game, availability, notes, created_at"
    )
    .eq("assignor_member_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const isAssignor = await requireAssignor(user.id, supabase);
  if (!isAssignor) {
    return NextResponse.json(
      { error: "Enable assignor mode on your dashboard before adding refs to your roster." },
      { status: 403 }
    );
  }

  let body: RosterBody;
  try {
    body = (await request.json()) as RosterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const displayName = (body.display_name ?? "").trim();
  if (!displayName) {
    return NextResponse.json({ error: "Ref name is required." }, { status: 400 });
  }

  const rateRaw = body.rate_per_game;
  const rateNum = rateRaw == null || rateRaw === ("" as unknown as number) ? null : Number(rateRaw);
  const ratePerGame = rateNum != null && Number.isFinite(rateNum) ? rateNum : null;

  const availability = Array.isArray(body.availability)
    ? body.availability
        .filter((slot) => slot?.start_at && slot?.end_at)
        .map((slot) => ({ start_at: slot.start_at, end_at: slot.end_at }))
    : [];

  const row = {
    assignor_member_id: user.id,
    display_name: displayName,
    primary_sport: (body.primary_sport ?? "").trim() || "Basketball",
    additional_sports: Array.isArray(body.additional_sports)
      ? body.additional_sports.map((s) => String(s).trim()).filter(Boolean)
      : [],
    certification_level: body.certification_level?.trim() || null,
    rate_per_game: ratePerGame,
    availability,
    notes: body.notes?.trim() || null,
    contact_email: body.contact_email?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("assignor_roster_entries")
    .insert(row)
    .select(
      "id, display_name, primary_sport, additional_sports, certification_level, rate_per_game, availability, notes, created_at"
    )
    .single();

  if (error) {
    console.error("[api/assignor/roster]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, entry: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Entry id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("assignor_roster_entries")
    .delete()
    .eq("id", id)
    .eq("assignor_member_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
