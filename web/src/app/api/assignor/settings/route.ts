import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type SettingsBody = { is_assignor?: boolean };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data } = await supabase
    .from("ref_profiles")
    .select("is_assignor")
    .eq("member_id", user.id)
    .maybeSingle();

  return NextResponse.json({ isAssignor: Boolean(data?.is_assignor) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const isAssignor = Boolean(body.is_assignor);

  try {
    const admin = createServiceClient();
    const { error } = await admin
      .from("ref_profiles")
      .update({ is_assignor: isAssignor, updated_at: new Date().toISOString() })
      .eq("member_id", user.id);
    if (error) throw error;
  } catch {
    const { error } = await supabase
      .from("ref_profiles")
      .update({ is_assignor: isAssignor, updated_at: new Date().toISOString() })
      .eq("member_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, isAssignor });
}
