import { NextResponse } from "next/server";
import { loadPublicRefIdCard, normalizeGotrefsId } from "@/lib/public-ref-id-card";

type RouteContext = { params: Promise<{ gotrefsId: string }> };

/** Public referee ID card JSON (used by the HTML fallback page). */
export async function GET(_request: Request, context: RouteContext) {
  const { gotrefsId: rawId } = await context.params;
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) {
    return NextResponse.json({ error: "Invalid GotREFS ID." }, { status: 400 });
  }

  try {
    const card = await loadPublicRefIdCard(gotrefsId);
    if (!card) {
      return NextResponse.json({ error: "Official ID not found." }, { status: 404 });
    }
    return NextResponse.json({ card });
  } catch (err) {
    console.error("[api/id]", err);
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }
}
