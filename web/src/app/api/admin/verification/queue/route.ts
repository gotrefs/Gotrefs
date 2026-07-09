import { NextResponse } from "next/server";
import { loadVerificationReviewQueue } from "@/lib/admin/verification-queue";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  try {
    const admin = createServiceClient();
    const { entries, error } = await loadVerificationReviewQueue(admin);

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load verification queue.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
