import { NextResponse } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ProfileBody = {
  bio?: string;
  primary_sport?: string;
  additional_sports?: string[];
  rate_per_official?: number | null;
  rate_type?: "exact" | "range";
  rate_min?: number | null;
  rate_max?: number | null;
};

function isMissingOrganizerRateColumn(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return ["rate_type", "rate_min", "rate_max"].some((column) => message.includes(column));
}

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
  const rateType = body.rate_type === "range" ? "range" : "exact";
  const minRaw = body.rate_min;
  const maxRaw = body.rate_max;
  const rateMinNum = minRaw == null || minRaw === ("" as unknown as number) ? null : Number(minRaw);
  const rateMaxNum = maxRaw == null || maxRaw === ("" as unknown as number) ? null : Number(maxRaw);

  const additionalSports = Array.isArray(body.additional_sports)
    ? body.additional_sports.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const row = {
    member_id: user.id,
    bio: (body.bio ?? "").trim(),
    primary_sport: (body.primary_sport ?? "").trim() || "Basketball",
    additional_sports: additionalSports,
    rate_per_official: ratePerOfficial,
    rate_type: rateType,
    rate_min: rateType === "range" && Number.isFinite(rateMinNum as number) ? rateMinNum : null,
    rate_max: rateType === "range" && Number.isFinite(rateMaxNum as number) ? rateMaxNum : null,
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
    let { error } = await admin.from("organizer_profiles").upsert(row, { onConflict: "member_id" });
    if (isMissingOrganizerRateColumn(error)) {
      const legacyRow: Record<string, unknown> = { ...row };
      delete legacyRow.rate_type;
      delete legacyRow.rate_min;
      delete legacyRow.rate_max;
      const retry = await admin.from("organizer_profiles").upsert(legacyRow, { onConflict: "member_id" });
      error = retry.error;
    }
    if (error) {
      console.error("[api/organizer/profile]", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    let { error } = await supabase.from("organizer_profiles").upsert(row, { onConflict: "member_id" });
    if (isMissingOrganizerRateColumn(error)) {
      const legacyRow: Record<string, unknown> = { ...row };
      delete legacyRow.rate_type;
      delete legacyRow.rate_min;
      delete legacyRow.rate_max;
      const retry = await supabase.from("organizer_profiles").upsert(legacyRow, { onConflict: "member_id" });
      error = retry.error;
    }
    if (error) {
      console.error("[api/organizer/profile] client upsert:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
}
