import { NextResponse } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ContactBody = {
  refMemberId?: string;
  subject?: string;
  message?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const canContact = await isOrganizerMember(supabase, user);
  if (!canContact) {
    return NextResponse.json(
      {
        error:
          "Only registered event organizers can contact refs. Sign up or log in as an organizer.",
      },
      { status: 403 }
    );
  }

  let body: ContactBody;
  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const refMemberId = (body.refMemberId ?? "").trim();
  const subject = (body.subject ?? "Availability inquiry").trim() || "Availability inquiry";
  const message = (body.message ?? "").trim();

  if (!refMemberId) {
    return NextResponse.json({ error: "Ref is required." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const { data: refMember } = await admin
    .from("members")
    .select("id, role")
    .eq("id", refMemberId)
    .maybeSingle();

  if (!refMember || refMember.role !== "ref") {
    return NextResponse.json({ error: "Ref not found." }, { status: 404 });
  }

  const { error } = await admin.from("ref_inquiries").insert({
    ref_member_id: refMemberId,
    organizer_member_id: user.id,
    subject,
    message,
  });

  if (error) {
    console.error("[api/refs/contact]", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
