import { NextResponse } from "next/server";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { createClient } from "@/lib/supabase/server";

export async function requireAdminApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!isGotrefsAdminUser(user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}
