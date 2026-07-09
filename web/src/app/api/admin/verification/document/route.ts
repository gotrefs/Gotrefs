import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/require-admin-api";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("error" in auth) return auth.error;

  const path = new URL(request.url).searchParams.get("path")?.trim();
  if (!path) {
    return NextResponse.json({ error: "path is required." }, { status: 400 });
  }

  if (path.includes("..") || path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const { data, error } = await admin.storage.from("verification_documents").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "Could not create document link." }, { status: 404 });
    }
    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load document.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
