import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ProfileBody = {
  bio?: string;
  primary_sport?: string;
  additional_sports?: string[];
  rate_per_official?: number | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const rateRaw = body.rate_per_official;
  const rateNum =
    rateRaw == null || rateRaw === ("" as unknown as number) ? null : Number(rateRaw);
  const ratePerOfficial = rateNum != null && Number.isFinite(rateNum) ? rateNum : null;

  const additionalSports = Array.isArray(body.additional_sports)
    ? body.additional_sports.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const row = {
    member_id: user.id,
    bio: (body.bio ?? "").trim(),
    primary_sport: (body.primary_sport ?? "").trim() || "Basketball",
    additional_sports: additionalSports,
    rate_per_official: ratePerOfficial,
    updated_at: new Date().toISOString(),
  };

  try {
    const admin = createServiceClient();
    const sync = await syncMemberAccount(admin, user);
    if (sync.role !== "organizer") {
      return NextResponse.json(
        { error: "Only event organizers can save an organization profile." },
        { status: 403 }
      );
    }
    const { error } = await admin.from("organizer_profiles").upsert(row, { onConflict: "member_id" });
    if (error) {
      console.error("[api/organizer/profile]", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    const { error } = await supabase.from("organizer_profiles").upsert(row, { onConflict: "member_id" });
    if (error) {
      console.error("[api/organizer/profile] client upsert:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
}
