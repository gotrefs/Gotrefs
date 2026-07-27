import type { PublicRefIdCard } from "@/lib/public-ref-id-card";
import { BRAND_NAME } from "@/lib/brand";
import {
  cityLabel,
  sportsList,
  splitAcceptedOrgs,
  verifyPageUrl,
} from "@/lib/verify-wallet";
import iconData from "@/lib/wallet/icon-data.json";

function png(name: keyof typeof iconData) {
  return Buffer.from(iconData[name], "base64");
}

/** In-memory Apple Wallet pass files (no external model path required). */
export function buildApplePassBuffers(card: PublicRefIdCard) {
  const sports = sportsList(card).join(", ") || "Official";
  const accepted = splitAcceptedOrgs(card).join(", ") || BRAND_NAME;
  const city = cityLabel(card);
  const verifyUrl = verifyPageUrl(card.gotrefsId);
  const passTypeIdentifier =
    process.env.APPLE_PASS_TYPE_IDENTIFIER?.trim() || "pass.org.gotrefs.official";
  const teamIdentifier = process.env.APPLE_TEAM_ID?.trim() || "TEAMID";
  const organizationName = process.env.APPLE_PASS_ORG_NAME?.trim() || "GotRefs";

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier,
    serialNumber: card.gotrefsId,
    teamIdentifier,
    organizationName,
    description: "GotRefs Official ID Card",
    logoText: "GotRefs",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(38, 33, 62)",
    labelColor: "rgb(201, 162, 39)",
    barcodes: [
      {
        message: verifyUrl,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: card.gotrefsId,
      },
    ],
    generic: {
      primaryFields: [
        {
          key: "status",
          label: "STATUS",
          value: "VERIFIED OFFICIAL",
        },
      ],
      secondaryFields: [
        { key: "refid", label: "REFEREE ID", value: card.gotrefsId },
        { key: "city", label: "CITY", value: city },
      ],
      auxiliaryFields: [
        { key: "sports", label: "SPORTS", value: sports },
        { key: "accepted", label: "ACCEPTED BY", value: accepted },
      ],
      backFields: [
        { key: "verify", label: "VERIFY ONLINE", value: verifyUrl },
        {
          key: "type",
          label: "TYPE",
          value: card.certificationLevel || `${BRAND_NAME} Accreditation`,
        },
      ],
    },
  };

  return {
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
    "icon.png": png("icon.png"),
    "paula.r@example.org": png("paula.r@example.org"),
    "carlos.r@example.net": png("carlos.r@example.net"),
    "logo.png": png("logo.png"),
  };
}
