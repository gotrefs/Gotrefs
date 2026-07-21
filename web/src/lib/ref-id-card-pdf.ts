"use client";

import { jsPDF } from "jspdf";
import { BRAND_NAME } from "@/lib/brand";
import type { RefereeIdCardPdfProps } from "@/components/RefereeIdCardPdf";

export type RefIdCardPdfData = RefereeIdCardPdfProps;

async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const isIos =
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function roundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: "F" | "S" | "FD" = "F"
) {
  const radius = Math.min(r, w / 2, h / 2);
  doc.roundedRect(x, y, w, h, radius, radius, style);
}

function badge(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  kind: "ok" | "warn" | "bad"
) {
  const padX = 4;
  const fontSize = 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  const tw = doc.getTextWidth(label.toUpperCase());
  const w = tw + padX * 2;
  const h = 10;
  if (kind === "ok") {
    doc.setFillColor(16, 185, 129);
    doc.setDrawColor(167, 243, 208);
    doc.setTextColor(236, 253, 245);
  } else if (kind === "bad") {
    doc.setFillColor(185, 28, 28);
    doc.setDrawColor(254, 202, 202);
    doc.setTextColor(254, 242, 242);
  } else {
    doc.setFillColor(113, 63, 18);
    doc.setDrawColor(253, 224, 71);
    doc.setTextColor(254, 249, 195);
  }
  roundedRect(doc, x, y, w, h, 5, "FD");
  doc.text(label.toUpperCase(), x + padX, y + 6.8);
  return w;
}

/**
 * Data-driven GotREFS ID card PDF (jsPDF drawing only — no DOM/Tailwind capture).
 */
export async function downloadRefIdCardPdf(
  data: RefIdCardPdfData,
  filename: string
): Promise<void> {
  const W = 420;
  const H = 640;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [W, H] });

  const name = data.fullName?.trim() || "Referee";
  const id = data.gotrefsId?.trim() || "GR-PENDING";
  const sport = data.primarySport?.trim()
    ? `${data.primarySport.trim()} Official`
    : "Official";
  const cert = data.certificationLevel?.trim() || "Certification level";
  const certOrg = data.certifiedBy?.trim() || "Certified By";
  const city = data.baseCity?.trim() || "Base city";
  const regions = (data.workRegions ?? []).filter(Boolean);
  const regionText = regions.length ? regions.slice(0, 3).join(", ") : "Regions willing to work";
  const radius = data.travelRadius?.trim() || "";
  const availability = data.availabilitySummary?.trim() || "Add availability";
  const rate = data.rate?.trim();
  const rateLabel = rate ? (rate.startsWith("$") ? `${rate}/game` : `$${rate}/game`) : "Set later";
  const screeningClear = data.backgroundStatus === "clear";
  const submitted = ["submitted", "under_review", "approved"].includes(data.verificationStatus ?? "");
  const showRedUnverified = Boolean(data.verificationSkipped && !screeningClear && !submitted);
  const sports = [data.primarySport, ...(data.additionalSports ?? [])].filter(
    (item): item is string => Boolean(item?.trim())
  );
  const statusText = screeningClear
    ? "Verified"
    : showRedUnverified
      ? "Unverified"
      : (data.verificationStatus ?? "Pending").replace(/_/g, " ");
  const validLabel = data.validThrough ? `Valid thru ${data.validThrough}` : "Active";

  const completionItems = [
    Boolean(data.fullName?.trim()),
    Boolean(data.primarySport?.trim()),
    Boolean(data.certificationLevel?.trim()),
    Boolean(data.baseCity?.trim() || regions.length || radius),
    Boolean(data.govIdUploaded),
    Boolean(data.certUploaded),
    screeningClear || submitted,
  ];
  const percent = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  // Card background (navy → deep red atmosphere via layered fills).
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(13, 27, 59);
  doc.rect(0, 0, W, Math.round(H * 0.42), "F");
  doc.setFillColor(127, 29, 29);
  doc.rect(0, Math.round(H * 0.62), W, Math.round(H * 0.38), "F");
  doc.setFillColor(8, 18, 38);
  doc.rect(0, Math.round(H * 0.35), W, Math.round(H * 0.35), "F");

  // Outer frame
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.2);
  roundedRect(doc, 14, 14, W - 28, H - 28, 22, "S");

  // Logo plate
  doc.setFillColor(255, 255, 255);
  roundedRect(doc, 28, 28, 118, 44, 10, "F");

  const logoAbs =
    typeof window !== "undefined"
      ? new URL(data.logoUrl || "/gotrefs-logo.png", window.location.origin).href
      : data.logoUrl || "/gotrefs-logo.png";
  const [logoData, avatarData] = await Promise.all([
    urlToDataUrl(logoAbs),
    data.avatarUrl ? urlToDataUrl(data.avatarUrl) : Promise.resolve(null),
  ]);

  if (logoData) {
    try {
      const format = logoData.startsWith("data:image/jpeg")
        ? "JPEG"
        : logoData.startsWith("data:image/webp")
          ? "WEBP"
          : "PNG";
      doc.addImage(logoData, format, 36, 34, 102, 32, undefined, "FAST");
    } catch {
      doc.setTextColor(2, 6, 23);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(BRAND_NAME, 42, 54);
    }
  } else {
    doc.setTextColor(2, 6, 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(BRAND_NAME, 42, 54);
  }

  // ID chip (top right)
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`${BRAND_NAME} ID`, W - 28, 40, { align: "right" });
  doc.setFillColor(8, 47, 73);
  doc.setDrawColor(103, 232, 249);
  const idW = Math.max(88, doc.getTextWidth(id) + 18);
  roundedRect(doc, W - 28 - idW, 46, idW, 18, 9, "FD");
  doc.setTextColor(236, 254, 255);
  doc.setFontSize(8);
  doc.text(id, W - 28 - idW / 2, 58, { align: "center" });

  // Avatar
  const avX = 32;
  const avY = 100;
  const avW = 110;
  const avH = 138;
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(255, 255, 255);
  roundedRect(doc, avX, avY, avW, avH, 18, "FD");
  if (avatarData) {
    try {
      const format = avatarData.startsWith("data:image/jpeg")
        ? "JPEG"
        : avatarData.startsWith("data:image/webp")
          ? "WEBP"
          : "PNG";
      doc.addImage(avatarData, format, avX + 2, avY + 2, avW - 4, avH - 4, undefined, "FAST");
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.text((data.avatarLabel || "REF").slice(0, 3), avX + avW / 2, avY + avH / 2 + 8, {
        align: "center",
      });
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text((data.avatarLabel || "REF").slice(0, 3), avX + avW / 2, avY + avH / 2 + 8, {
      align: "center",
    });
  }

  // Valid thru pill
  doc.setFillColor(74, 222, 128);
  const validW = Math.min(avW + 8, doc.getTextWidth(validLabel) + 16);
  roundedRect(doc, avX + (avW - validW) / 2, avY + avH - 8, validW, 16, 8, "F");
  doc.setTextColor(5, 46, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(validLabel, avX + avW / 2, avY + avH + 3, { align: "center" });

  // Name / sport block
  const textX = 158;
  doc.setTextColor(165, 243, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text((data.cardTitle || `${BRAND_NAME} verified official`).toUpperCase(), textX, 118);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  const nameLines = doc.splitTextToSize(name, W - textX - 28);
  doc.text(nameLines.slice(0, 2), textX, 142);

  doc.setTextColor(207, 250, 254);
  doc.setFontSize(12);
  doc.text(sport, textX, 178);

  // Level / rate panels
  const panelY = 196;
  doc.setFillColor(30, 41, 59);
  roundedRect(doc, textX, panelY, 110, 46, 10, "F");
  roundedRect(doc, textX + 118, panelY, 110, 46, 10, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.text("LEVEL", textX + 10, panelY + 14);
  doc.text("RATE", textX + 128, panelY + 14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(cert, 90)[0], textX + 10, panelY + 30);
  doc.text(doc.splitTextToSize(rateLabel, 90)[0], textX + 128, panelY + 30);

  // Regions + sports
  let y = 270;
  doc.setFillColor(30, 41, 59);
  roundedRect(doc, 28, y, 230, 100, 12, "F");
  roundedRect(doc, 268, y, W - 296, 100, 12, "F");

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("REGIONS WILLING TO WORK", 40, y + 16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(regionText, 200), 40, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`${city}${radius ? ` · ${radius} mi radius` : ""}`, 40, y + 70);
  if (radius) {
    doc.setFillColor(51, 65, 85);
    roundedRect(doc, 40, y + 80, 70, 12, 6, "F");
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(Number(radius) > 0 ? "TRAVEL YES" : "TRAVEL NO", 48, y + 88);
  }

  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("ELIGIBLE SPORTS", 280, y + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const sportLines = sports.length ? sports.slice(0, 5) : ["Add sports"];
  sportLines.forEach((s, i) => {
    doc.text(`• ${s}`, 280, y + 34 + i * 12);
  });

  // Certified by
  y = 386;
  doc.setFillColor(30, 41, 59);
  roundedRect(doc, 28, y, W - 56, 40, 12, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("CERTIFIED BY", 40, y + 14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(certOrg, 40, y + 30);

  // Badges
  y = 440;
  let bx = 28;
  const badges: Array<{ label: string; kind: "ok" | "warn" | "bad" }> = [
    {
      label: data.profileComplete || data.primarySport ? "Profile Ready" : "Profile Pending",
      kind: data.profileComplete || data.primarySport ? "ok" : "warn",
    },
    {
      label: data.govIdUploaded ? "Identity Verified" : showRedUnverified ? "Unverified" : "Identity Processing",
      kind: data.govIdUploaded ? "ok" : showRedUnverified ? "bad" : "warn",
    },
    {
      label: data.certUploaded ? "Certified Official" : showRedUnverified ? "Unverified" : "Cert Processing",
      kind: data.certUploaded ? "ok" : showRedUnverified ? "bad" : "warn",
    },
    {
      label:
        screeningClear || submitted
          ? "Background Checked"
          : showRedUnverified
            ? "Unverified"
            : "Background Processing",
      kind: screeningClear || submitted ? "ok" : showRedUnverified ? "bad" : "warn",
    },
  ];
  for (const b of badges) {
    const bw = badge(doc, bx, y, b.label, b.kind);
    bx += bw + 6;
    if (bx > W - 80) {
      bx = 28;
      y += 14;
    }
  }

  // Availability / status
  y = 478;
  doc.setFillColor(30, 41, 59);
  roundedRect(doc, 28, y, (W - 64) / 2, 54, 12, "F");
  roundedRect(doc, 28 + (W - 64) / 2 + 8, y, (W - 64) / 2, 54, 12, "F");
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("AVAILABILITY", 40, y + 14);
  doc.text("STATUS", 28 + (W - 64) / 2 + 20, y + 14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(availability, 160), 40, y + 32);
  doc.text(statusText, 28 + (W - 64) / 2 + 20, y + 32);

  // Card build bar
  y = 548;
  doc.setTextColor(203, 213, 225);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Card build", 28, y);
  doc.text(`${percent}%`, W - 28, y, { align: "right" });
  doc.setFillColor(51, 65, 85);
  roundedRect(doc, 28, y + 8, W - 56, 10, 5, "F");
  doc.setFillColor(103, 232, 249);
  const barW = Math.max(4, ((W - 56) * percent) / 100);
  roundedRect(doc, 28, y + 8, barW, 10, 5, "F");

  // Footer
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  const extra =
    (data.additionalSports ?? []).length > 0
      ? `Also covers: ${(data.additionalSports ?? []).slice(0, 4).join(", ")}`
      : "Add more sports and badges as your profile grows.";
  doc.text(doc.splitTextToSize(extra, W - 56), 28, y + 36);

  doc.setFontSize(7);
  doc.text(`Issued by ${BRAND_NAME}`, 28, H - 24);

  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isMobile && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "GotREFS ID Card" });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  triggerBlobDownload(blob, filename);
}

export function cardValidThrough(reviewedAtIso: string | null | undefined): Date | null {
  if (!reviewedAtIso) return null;
  const start = new Date(reviewedAtIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end;
}

export function formatCardValidThrough(reviewedAtIso: string | null | undefined): string | null {
  const end = cardValidThrough(reviewedAtIso);
  if (!end) return null;
  return end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
