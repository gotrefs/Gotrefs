import { NextResponse } from "next/server";
import { loadSignupUploads } from "@/lib/admin/signup-uploads";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Admin only: one person's card details and links to the files they uploaded. */
export async function GET(_request: Request, context: { params: Promise<{ memberId: string }> }) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  const { memberId } = await context.params;
  try {
    const uploads = await loadSignupUploads(createServiceClient(), memberId);
    if (!uploads) return NextResponse.json({ error: "No account found for that person." }, { status: 404 });
    return NextResponse.json(uploads, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load uploaded info.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
