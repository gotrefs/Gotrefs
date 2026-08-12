import { NextResponse } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { loadOrganizerPayments } from "@/lib/stripe/organizer-receipts";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", payments: [] }, { status: 401 });
  }

  const canView = await isOrganizerMember(supabase, user);
  if (!canView) {
    return NextResponse.json({ error: "Organizer access required.", payments: [] }, { status: 403 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error.", payments: [] }, { status: 503 });
  }

  try {
    const payments = await loadOrganizerPayments(admin, user.id);
    return NextResponse.json({ payments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load payments.";
    return NextResponse.json({ error: message, payments: [] }, { status: 400 });
  }
}
