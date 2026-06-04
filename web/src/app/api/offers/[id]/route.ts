import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refOfferEligible } from "@/lib/ref-eligibility";

type Action = "accept" | "decline" | "cancel";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: Action;
  try {
    const b = (await request.json()) as { action?: string };
    if (b.action !== "accept" && b.action !== "decline" && b.action !== "cancel") {
      return NextResponse.json(
        { error: "action must be accept, decline, or cancel" },
        { status: 400 }
      );
    }
    action = b.action;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: offer, error: oErr } = await supabase
    .from("assignment_offers")
    .select("id, ref_member_id, status, event_id")
    .eq("id", id)
    .single();

  if (oErr || !offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const isRef = offer.ref_member_id === user.id;
  let isOrg = false;
  if (!isRef) {
    const { data: ev } = await supabase
      .from("scheduled_events")
      .select("organizer_member_id")
      .eq("id", offer.event_id)
      .single();
    isOrg = ev?.organizer_member_id === user.id;
  }

  if (!isRef && !isOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offer.status !== "pending") {
    return NextResponse.json({ error: "Offer is no longer pending" }, { status: 400 });
  }

  if (action === "accept" && !isRef) {
    return NextResponse.json({ error: "Only the referee can accept" }, { status: 403 });
  }

  if (action === "accept" && isRef) {
    const [{ data: screening }, { data: profile }, { data: submission }] = await Promise.all([
      supabase.from("screening_checks").select("status").eq("ref_member_id", user.id).maybeSingle(),
      supabase
        .from("ref_profiles")
        .select(
          "verification_method, external_verification_proof_path, government_id_path, verification_doc_path, certification_document_path, bio, primary_sport, certification_level"
        )
        .eq("member_id", user.id)
        .maybeSingle(),
      supabase
        .from("ref_verification_submissions")
        .select("status")
        .eq("ref_member_id", user.id)
        .maybeSingle(),
    ]);

    if (
      !refOfferEligible({
        screeningStatus: screening?.status,
        verificationMethod: profile?.verification_method,
        externalProofPath: profile?.external_verification_proof_path,
        verificationSubmissionStatus: submission?.status,
        profile,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Complete verification first: upload ID and certification, fill out your profile, and submit your verification package.",
        },
        { status: 400 }
      );
    }

    if (screening?.status !== "clear") {
      await supabase
        .from("screening_checks")
        .update({
          status: "clear",
          summary: "Eligible via completed verification package",
          updated_at: new Date().toISOString(),
        })
        .eq("ref_member_id", user.id);
    }
  }

  if (action === "decline" && !isRef) {
    return NextResponse.json({ error: "Only the referee can decline" }, { status: 403 });
  }

  if (action === "cancel" && !isOrg) {
    return NextResponse.json({ error: "Only the organizer can cancel an offer" }, { status: 403 });
  }

  const nextStatus =
    action === "accept" ? "accepted" : action === "cancel" ? "canceled" : "declined";
  const { error: uErr } = await supabase
    .from("assignment_offers")
    .update({ status: nextStatus })
    .eq("id", id);

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
