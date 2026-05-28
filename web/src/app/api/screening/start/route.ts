import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { startCheckrScreening } from "@/lib/screening/checkr";

/**
 * Starts third-party screening for the signed-in referee.
 * - Dev: SCREENING_DEV_BYPASS=true uses RPC dev_mark_screening_clear (no service role).
 * - Production Checkr: needs CHECKR_API_KEY + SUPABASE_SERVICE_ROLE_KEY for webhook updates.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single();

  if (!member || member.role !== "ref") {
    return NextResponse.json({ error: "Only referees can start screening" }, { status: 403 });
  }

  const email = user.email || "";
  const devBypass =
    process.env.SCREENING_DEV_BYPASS === "true" && process.env.NODE_ENV !== "production";

  if (devBypass) {
    const { error: rpcError } = await supabase.rpc("dev_mark_screening_clear");
    if (rpcError) {
      const hint =
        rpcError.message.includes("dev_mark_screening_clear")
          ? ' Run supabase/migrations/20260215100000_dev_screening_clear_rpc.sql in the Supabase SQL Editor, then try again.'
          : "";
      return NextResponse.json(
        { error: `Could not update screening: ${rpcError.message}.${hint}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, mode: "dev_bypass" });
  }

  let svc;
  try {
    svc = createServiceClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Server missing SUPABASE_SERVICE_ROLE_KEY. For local testing, set SCREENING_DEV_BYPASS=true in .env.local and run the dev_screening_clear_rpc migration.",
      },
      { status: 503 }
    );
  }

  const checkr = await startCheckrScreening({
    refMemberId: user.id,
    email,
    fullName: member.display_name || email,
    zip: null,
  });

  if (checkr.skipped) {
    const { error: upErr } = await svc
      .from("screening_checks")
      .update({
        status: "invited",
        summary: "Checkr is not configured. Add CHECKR_API_KEY or use dev bypass locally.",
        updated_at: new Date().toISOString(),
      })
      .eq("ref_member_id", user.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode: "pending_configuration",
      message:
        "No Checkr API key found. Screening row marked invited; configure Checkr for live checks.",
    });
  }

  if (!checkr.ok || !checkr.externalCandidateId) {
    return NextResponse.json(
      { error: checkr.error || "Checkr start failed" },
      { status: 502 }
    );
  }

  const { error: upErr } = await svc
    .from("screening_checks")
    .update({
      external_candidate_id: checkr.externalCandidateId,
      status: "pending",
      summary: "Invitation sent to Checkr",
      updated_at: new Date().toISOString(),
    })
    .eq("ref_member_id", user.id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "checkr", candidateId: checkr.externalCandidateId });
}
