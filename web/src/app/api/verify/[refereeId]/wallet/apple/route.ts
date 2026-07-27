import { NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import { buildApplePassBuffers } from "@/lib/wallet/apple-pass-buffers";
import { isAppleWalletConfigured, loadVerifyCard } from "@/lib/verify-wallet";

type RouteContext = { params: Promise<{ refereeId: string }> };

export const dynamic = "force-dynamic";

/**
 * Generate an Apple Wallet .pkpass for a GotREFS official ID.
 *
 * Required env:
 * - APPLE_PASS_CERT_PEM
 * - APPLE_PASS_KEY_PEM
 * - APPLE_PASS_WWDR_PEM
 * - APPLE_PASS_TYPE_IDENTIFIER
 * - APPLE_TEAM_ID
 */
export async function GET(_request: Request, context: RouteContext) {
  const { refereeId } = await context.params;
  const card = await loadVerifyCard(refereeId);
  if (!card) {
    return NextResponse.json({ error: "Official ID not found." }, { status: 404 });
  }

  if (!isAppleWalletConfigured()) {
    return NextResponse.json(
      {
        setupRequired: true,
        fallback: "image",
        message: "Apple Wallet signing is not configured on this server yet.",
      },
      { status: 501 }
    );
  }

  try {
    const buffers = buildApplePassBuffers(card);
    const pass = new PKPass(
      buffers,
      {
        wwdr: process.env.APPLE_PASS_WWDR_PEM!,
        signerCert: process.env.APPLE_PASS_CERT_PEM!,
        signerKey: process.env.APPLE_PASS_KEY_PEM!,
        signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
      },
      {
        serialNumber: card.gotrefsId,
        description: "GotREFS Official ID Card",
        organizationName: process.env.APPLE_PASS_ORG_NAME?.trim() || "GotREFS",
      }
    );

    const buffer = pass.getAsBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="GotREFS-${card.gotrefsId}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[wallet/apple]", err);
    return NextResponse.json(
      {
        setupRequired: true,
        fallback: "image",
        message: "Could not build an Apple Wallet pass with the current certificates.",
      },
      { status: 501 }
    );
  }
}
