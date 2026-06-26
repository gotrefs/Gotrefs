import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refOfferEligible } from "@/lib/ref-eligibility";

type Body = {
  eventId: string;
  refMemberId: string;
  offeredPay?: number | null;
  message?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.eventId || !body.refMemberId) {
    return NextResponse.json({ error: "eventId and refMemberId required" }, { status: 400 });
  }

  const { data: event, error: evErr } = await supabase
    .from("scheduled_events")
    .select("id, organizer_member_id, pay_offer")
    .eq("id", body.eventId)
    .single();

  if (evErr || !event || event.organizer_member_id !== user.id) {
    return NextResponse.json({ error: "Event not found or not yours" }, { status: 403 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const [{ data: screening }, { data: profile }, { data: submission }] = await Promise.all([
    admin.from("screening_checks").select("status").eq("ref_member_id", body.refMemberId).maybeSingle(),
    admin
      .from("ref_profiles")
      .select(
        "verification_method, external_verification_proof_path, government_id_path, verification_doc_path, certification_document_path, bio, primary_sport, certification_level"
      )
      .eq("member_id", body.refMemberId)
      .maybeSingle(),
    admin
      .from("ref_verification_submissions")
      .select("status")
      .eq("ref_member_id", body.refMemberId)
      .maybeSingle(),
  ]);

  const eligible = refOfferEligible({
    screeningStatus: screening?.status,
    verificationMethod: profile?.verification_method,
    externalProofPath: profile?.external_verification_proof_path,
    verificationSubmissionStatus: submission?.status,
    profile,
  });

  if (!eligible) {
    return NextResponse.json(
      {
        error:
          "This referee has not completed their profile and verification package yet.",
      },
      { status: 400 }
    );
  }

  const offeredPay = body.offeredPay ?? event.pay_offer ?? null;

  const { data, error } = await supabase
    .from("assignment_offers")
    .upsert({
      event_id: body.eventId,
      ref_member_id: body.refMemberId,
      offered_pay: offeredPay,
      message: body.message ?? null,
      status: "pending",
    }, {
      onConflict: "event_id,ref_member_id",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, offerId: data.id });
}
