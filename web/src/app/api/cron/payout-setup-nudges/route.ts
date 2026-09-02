import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processDuePayoutSetupNudges } from "@/lib/stripe/payout-setup-nudge";

/**
 * Process day-after-signup “add payout method” emails.
 * - Authenticated ref: only themselves (called from referee dashboard).
 * - Cron: Authorization Bearer CRON_SECRET (or x-cron-secret) processes all due.
 */
export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const isCron =
    isVercelCron ||
    (Boolean(cronSecret) &&
      (authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret));

  if (isCron) {
    const result = await processDuePayoutSetupNudges(admin);
    return NextResponse.json({ ok: true, ...result });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDuePayoutSetupNudges(admin, { onlyMemberId: user.id, limit: 1 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  // Vercel Cron uses GET by default.
  return POST(request);
}
