import { jsPDF } from "jspdf";
import type { PublicRefIdCard } from "@/lib/public-ref-id-card";

const NAVY: [number, number, number] = [38, 33, 62];
const NAVY_DEEP: [number, number, number] = [26, 23, 48];
const NAVY_MID: [number, number, number] = [61, 56, 81];
const GOLD: [number, number, number] = [201, 162, 39];
const WHITE: [number, number, number] = [255, 255, 255];
const INK: [number, number, number] = [32, 36, 66];

function splitList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Fetch remote image and normalize to JPEG/PNG data URL (jsPDF has weak WEBP support). */
async function urlToPdfImage(url: string | null | undefined): Promise<{ dataUrl: string; format: "JPEG" | "PNG" } | null> {
  if (!url) return null;
  if (url.startsWith("data:image/png")) return { dataUrl: url, format: "PNG" };
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) {
    return { dataUrl: url, format: "JPEG" };
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());

    if (contentType.includes("png") || url.startsWith("data:image/png")) {
      return { dataUrl: `data:image/png;base64,${buf.toString("base64")}`, format: "PNG" };
    }

    // Convert WEBP / unknown formats via sharp-less canvas alternative: re-encode as JPEG label.
    // jsPDF accepts JPEG reliably; browsers and Node fetch often return WEBP from storage.
    if (contentType.includes("webp") || contentType.includes("gif") || contentType.includes("avif")) {
      // Fall back: try PNG/JPEG add with JPEG hint after stripping — if WEBP bytes fail, caller skips.
      // Prefer labeling as JPEG only when content is actually jpeg.
      return null;
    }

    return { dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`, format: "JPEG" };
  } catch {
    return null;
  }
}

/**
 * Build an organizer-friendly GotREFS ID PDF (no legal name).
 * Returned as ArrayBuffer for an inline PDF response.
 */
export async function buildPublicRefIdCardPdf(card: PublicRefIdCard): Promise<ArrayBuffer> {
  const W = 420;
  const H = 640;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [W, H] });

  const id = card.gotrefsId?.trim() || "GR-PENDING";
  const sports = [card.primarySport, ...(card.additionalSports ?? [])]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const accepted = splitList(card.certifiedBy);
  const city =
    card.baseCity?.trim() ||
    (card.workRegions ?? []).filter(Boolean).slice(0, 2).join(", ") ||
    "—";
  const typeLabel = card.certificationLevel?.trim() || "GotREFS Accreditation";
  const expire = card.validThrough?.trim() || "Pending approval";
  const years = card.validThrough?.match(/(20\d{2})/)?.[1];
  const validLabel = years ? `Valid ${Number(years) - 1}-${years}` : "Valid pending";

  const [photo, logo] = await Promise.all([
    urlToPdfImage(card.avatarUrl),
    urlToPdfImage("https://gotrefs.org/gotrefs-logo-blue-background.png"),
  ]);

  // Outer card
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(3);
  doc.rect(4, 4, W - 8, H - 8, "S");

  // Header
  doc.setFillColor(...NAVY_DEEP);
  doc.rect(8, 8, W - 16, 58, "F");
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, 16, 16, 52, 42);
    } catch {
      // ignore logo failures
    }
  }
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("GOTREFS VERIFIED OFFICIAL NETWORK", W / 2 + 16, 28, { align: "center" });
  doc.setFontSize(18);
  doc.text("OFFICIAL ID CARD", W / 2 + 16, 50, { align: "center" });

  // White identity panel
  doc.setFillColor(...WHITE);
  doc.rect(8, 66, W - 16, 150, "F");

  // Photo frame
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  doc.rect(24, 80, 92, 92, "S");
  if (photo) {
    try {
      doc.addImage(photo.dataUrl, photo.format, 26, 82, 88, 88);
    } catch {
      doc.setFillColor(...NAVY_MID);
      doc.rect(26, 82, 88, 88, "F");
    }
  } else {
    doc.setFillColor(...NAVY_MID);
    doc.rect(26, 82, 88, 88, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(12);
    doc.text("PHOTO", 70, 130, { align: "center" });
  }

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(validLabel.toUpperCase(), 70, 190, { align: "center" });

  // Details (no name)
  let y = 92;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Referee ID:", 132, y);
  doc.setFont("helvetica", "normal");
  doc.text(id, 205, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Expire Date:", 132, y);
  doc.setFont("helvetica", "normal");
  doc.text(expire, 210, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Type:", 132, y);
  doc.setFont("helvetica", "normal");
  const typeLines = doc.splitTextToSize(typeLabel.toUpperCase(), 230);
  doc.text(typeLines, 168, y);

  // Brand band
  doc.setFillColor(...NAVY);
  doc.rect(8, 216, W - 16, 78, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("GOT REF'S", W / 2, 252, { align: "center" });
  doc.setFillColor(...NAVY_MID);
  doc.roundedRect(W / 2 - 78, 262, 156, 18, 3, 3, "F");
  doc.setFontSize(9);
  doc.text("QUALIFIED OFFICIALS", W / 2, 274, { align: "center" });

  // Games + Location boxes
  const boxTop = 304;
  const boxH = 150;
  const leftW = (W - 16 - 12) / 2;

  function drawBoxHeader(x: number, top: number, title: string, w: number) {
    doc.setFillColor(240, 215, 140);
    doc.rect(x, top, w, 18, "F");
    doc.setFillColor(...GOLD);
    doc.rect(x, top + 14, w, 4, "F");
    doc.setTextColor(74, 50, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), x + 8, top + 12);
  }

  doc.setFillColor(...WHITE);
  doc.rect(8, boxTop, leftW, boxH, "F");
  drawBoxHeader(8, boxTop, "Games certified to ref", leftW);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let sy = boxTop + 30;
  const sportLines = sports.length ? sports : ["None listed"];
  for (const sport of sportLines.slice(0, 10)) {
    doc.text(`• ${sport}`, 16, sy);
    sy += 12;
  }
  if (sportLines.length > 10) {
    doc.text(`• +${sportLines.length - 10} more`, 16, sy);
  }

  doc.setFillColor(...WHITE);
  doc.rect(8 + leftW + 12, boxTop, leftW, boxH, "F");
  drawBoxHeader(8 + leftW + 12, boxTop, "Location", leftW);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("City:", 8 + leftW + 20, boxTop + 36);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(city, leftW - 28), 8 + leftW + 48, boxTop + 36);

  // Accepted by box
  const accTop = boxTop + boxH + 12;
  const accH = 140;
  doc.setFillColor(...WHITE);
  doc.rect(8, accTop, W - 16, accH, "F");
  drawBoxHeader(8, accTop, "Accepted by", W - 16);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ay = accTop + 32;
  const acceptedLines = accepted.length ? accepted : ["None listed"];
  for (const org of acceptedLines.slice(0, 8)) {
    doc.text(`• ${org}`, 16, ay);
    ay += 12;
  }
  if (acceptedLines.length > 8) {
    doc.text(`• +${acceptedLines.length - 8} more`, 16, ay);
  }

  // Footer
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Scan-verified GotREFS official ID · Photo on file", W / 2, H - 18, {
    align: "center",
  });

  const out = doc.output("arraybuffer");
  if (out instanceof ArrayBuffer) return out;
  const view = new Uint8Array(out as ArrayBufferLike);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}
