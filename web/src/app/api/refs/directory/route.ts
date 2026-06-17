import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/mask-email";
import { isOrganizerMember } from "@/lib/organizer-access";
import { sportEmoji } from "@/lib/sport-emoji";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type AvailabilitySlot = { start_at: string; end_at: string };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in.", canContact: false, refs: [] }, { status: 401 });
  }

  const canContact = await isOrganizerMember(supabase, user);
  if (!canContact) {
    return NextResponse.json({
      canContact: false,
      refs: [],
      message: "Only registered event organizers can browse ref availability and contact refs.",
    });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: members, error: memErr } = await admin
    .from("members")
    .select("id, display_name, home_zip, ref_profiles ( primary_sport, rate_per_game )")
    .eq("role", "ref");

  if (memErr) {
    console.error("[api/refs/directory]", memErr.message);
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  const refIds = (members ?? []).map((m) => m.id);
  const { data: availability } = await admin
    .from("ref_availability")
    .select("ref_member_id, start_at, end_at")
    .in("ref_member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  const availByRef = new Map<string, AvailabilitySlot[]>();
  for (const slot of availability ?? []) {
    const list = availByRef.get(slot.ref_member_id) ?? [];
    list.push({ start_at: slot.start_at, end_at: slot.end_at });
    availByRef.set(slot.ref_member_id, list);
  }

  const refs = [];
  for (const m of members ?? []) {
    const { data: eligible } = await admin.rpc("ref_is_offer_eligible", { ref_id: m.id });
    if (!eligible) continue;

    const rp = Array.isArray(m.ref_profiles) ? m.ref_profiles[0] : m.ref_profiles;
    const primarySport = rp?.primary_sport ?? "Basketball";

    const { data: authUser } = await admin.auth.admin.getUserById(m.id);
    const email = authUser?.user?.email ?? "";
    const maskedEmail = email ? maskEmail(email) : "•••@•••.•••";

    refs.push({
      id: m.id,
      displayName: m.display_name,
      primarySport,
      sportEmoji: sportEmoji(primarySport),
      ratePerGame: rp?.rate_per_game ?? null,
      homeZip: m.home_zip,
      availability: availByRef.get(m.id) ?? [],
      maskedEmail,
    });
  }

  return NextResponse.json({ canContact: true, refs });
}
