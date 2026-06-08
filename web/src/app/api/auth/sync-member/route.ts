import { NextResponse, type NextRequest } from "next/server";
import { syncMemberAccount } from "@/lib/auth/sync-member";
import { createRouteHandlerClient, jsonWithSessionCookies } from "@/lib/supabase/route-handler";
import { createServiceClient } from "@/lib/supabase/service";

/** Ensure auth.users has a matching public.members row with the correct role. */
export async function POST(request: NextRequest) {
  const sessionResponse = NextResponse.next();
  const supabase = createRouteHandlerClient(request, sessionResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return jsonWithSessionCookies(sessionResponse, {
      ok: true,
      skipped: "no_service_role",
      role: user.user_metadata?.role === "organizer" ? "organizer" : "ref",
    });
  }

  const result = await syncMemberAccount(admin, user);
  return jsonWithSessionCookies(sessionResponse, result);
}
