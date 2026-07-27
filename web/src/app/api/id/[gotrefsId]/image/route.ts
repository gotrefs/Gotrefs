import { NextResponse } from "next/server";
import { normalizeGotrefsId } from "@/lib/public-ref-id-card";

type RouteContext = { params: Promise<{ gotrefsId: string }> };

export const dynamic = "force-dynamic";

/** Legacy image URL → verify page used by QR scans. */
export async function GET(request: Request, context: RouteContext) {
  const { gotrefsId: rawId } = await context.params;
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) {
    return new NextResponse("Invalid GotRefs ID.", { status: 400 });
  }
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/verify/${encodeURIComponent(gotrefsId)}`, url.origin), 302);
}
