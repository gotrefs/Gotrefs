import { NextResponse } from "next/server";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({ isAdmin: isGotrefsAdminUser(user) });
}
