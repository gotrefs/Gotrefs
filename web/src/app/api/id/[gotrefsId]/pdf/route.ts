import { NextResponse } from "next/server";
import { loadPublicRefIdCard, normalizeGotrefsId } from "@/lib/public-ref-id-card";
import { buildPublicRefIdCardPdf } from "@/lib/public-ref-id-card-pdf";

type RouteContext = { params: Promise<{ gotrefsId: string }> };

/**
 * Instant organizer scan target: returns an inline PDF of the official ID card + photo.
 * Phone cameras open this PDF viewer immediately — no dashboard required.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { gotrefsId: rawId } = await context.params;
  const gotrefsId = normalizeGotrefsId(rawId || "");
  if (!gotrefsId || gotrefsId.length < 4) {
    return new NextResponse("Invalid GotREFS ID.", { status: 400 });
  }

  try {
    const card = await loadPublicRefIdCard(gotrefsId);
    if (!card) {
      return new NextResponse("Official ID not found.", { status: 404 });
    }

    const pdf = await buildPublicRefIdCardPdf(card);
    const filename = `GotREFS-ID-${card.gotrefsId.replace(/[^\w\-]+/g, "-")}.pdf`;
    const bytes = pdf instanceof ArrayBuffer ? new Uint8Array(pdf) : pdf;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error("[api/id/pdf]", err);
    return new NextResponse("Could not generate ID card PDF.", { status: 500 });
  }
}
