import { createSign } from "crypto";
import { NextResponse } from "next/server";
import {
  cityLabel,
  isGoogleWalletConfigured,
  loadVerifyCard,
  sportsList,
  splitAcceptedOrgs,
  verifyPageUrl,
} from "@/lib/verify-wallet";

type RouteContext = { params: Promise<{ refereeId: string }> };

export const dynamic = "force-dynamic";

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtRs256(payload: Record<string, unknown>, privateKeyPem: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKeyPem);
  return `${data}.${base64url(signature)}`;
}

/**
 * Google Wallet save link for a GotRefs official ID (Generic pass).
 * Requires GOOGLE_WALLET_ISSUER_ID + service-account email/private key.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { refereeId } = await context.params;
  const card = await loadVerifyCard(refereeId);
  if (!card) {
    return NextResponse.json({ error: "Official ID not found." }, { status: 404 });
  }

  if (!isGoogleWalletConfigured()) {
    return NextResponse.json(
      {
        setupRequired: true,
        fallback: "image",
        message: "Google Wallet is not configured on this server yet.",
      },
      { status: 501 }
    );
  }

  try {
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!.trim();
    const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL!.trim();
    const privateKey = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY!.replace(/\\n/g, "\n");
    const classId = `${issuerId}.${process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || "gotrefs_official_id"}`;
    const objectId = `${issuerId}.${card.gotrefsId.replace(/[^\w\-]+/g, "_")}`;
    const verifyUrl = verifyPageUrl(card.gotrefsId);
    const sports = sportsList(card).join(", ") || "Official";
    const accepted = splitAcceptedOrgs(card).join(", ") || "GotRefs";
    const city = cityLabel(card);

    const claims = {
      iss: saEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: {
        genericObjects: [
          {
            id: objectId,
            classId,
            cardTitle: {
              defaultValue: {
                language: "en-US",
                value: "GotRefs Verified Official",
              },
            },
            header: {
              defaultValue: {
                language: "en-US",
                value: "VERIFIED OFFICIAL",
              },
            },
            subheader: {
              defaultValue: {
                language: "en-US",
                value: card.gotrefsId,
              },
            },
            textModulesData: [
              { id: "sports", header: "Certified sports", body: sports },
              { id: "city", header: "City", body: city },
              { id: "accepted", header: "Accepted by", body: accepted },
            ],
            barcode: {
              type: "QR_CODE",
              value: verifyUrl,
              alternateText: card.gotrefsId,
            },
            hexBackgroundColor: "#26213e",
          },
        ],
      },
      origins: [verifyUrl.replace(/\/verify\/.*$/, "")],
    };

    const token = signJwtRs256(claims, privateKey);
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
    return NextResponse.json({ saveUrl });
  } catch (err) {
    console.error("[wallet/google]", err);
    return NextResponse.json(
      {
        setupRequired: true,
        fallback: "image",
        message: "Could not create a Google Wallet save link.",
      },
      { status: 501 }
    );
  }
}
