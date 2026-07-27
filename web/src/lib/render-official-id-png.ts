/**
 * Draw a GotREFS official ID card to a PNG blob (no DOM screenshot / CORS issues).
 */

export type OfficialIdRenderInput = {
  gotrefsId: string;
  primarySport?: string | null;
  additionalSports?: string[];
  certifiedBy?: string | null;
  certificationLevel?: string | null;
  baseCity?: string | null;
  workRegions?: string[];
  avatarUrl?: string | null;
  validThrough?: string | null;
  verified?: boolean;
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    // Same-origin proxy URLs don't need CORS; external URLs might.
    if (!url.startsWith("/") && !url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cy = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, cy);
}

export async function renderOfficialIdPng(input: OfficialIdRenderInput): Promise<Blob> {
  const W = 900;
  const H = 560;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#26213e");
  bg.addColorStop(0.55, "#1a1730");
  bg.addColorStop(1, "#0f0e1a");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  // Gold top bar
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(0, 0, W, 10);

  // Brand
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("GOTREFS", 36, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("OFFICIAL ID CARD", 36, 88);

  if (input.verified) {
    ctx.fillStyle = "#10b981";
    roundRect(ctx, W - 250, 34, 214, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("✓  VERIFIED OFFICIAL", W - 230, 60);
  }

  // White panel
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 28, 120, W - 56, 300, 18);
  ctx.fill();

  // Photo
  const photoX = 52;
  const photoY = 148;
  const photoS = 160;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoS, photoS, 8);
  ctx.clip();
  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(photoX, photoY, photoS, photoS);

  if (input.avatarUrl) {
    const photo = await loadImage(input.avatarUrl);
    if (photo) {
      const scale = Math.max(photoS / photo.width, photoS / photo.height);
      const dw = photo.width * scale;
      const dh = photo.height * scale;
      ctx.drawImage(photo, photoX + (photoS - dw) / 2, photoY + (photoS - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#26213e";
      ctx.fillRect(photoX, photoY, photoS, photoS);
      ctx.fillStyle = "#c9a227";
      ctx.font = "800 28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("ID", photoX + 58, photoY + 92);
    }
  } else {
    ctx.fillStyle = "#26213e";
    ctx.fillRect(photoX, photoY, photoS, photoS);
    ctx.fillStyle = "#c9a227";
    ctx.font = "800 28px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("ID", photoX + 58, photoY + 92);
  }
  ctx.restore();

  // Gold photo border
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 4;
  roundRect(ctx, photoX, photoY, photoS, photoS, 8);
  ctx.stroke();

  const sports = [input.primarySport, ...(input.additionalSports ?? [])]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const sportsLabel = sports.length ? sports.join(" · ") : "Not listed";
  const city =
    input.baseCity?.trim() ||
    (input.workRegions ?? []).filter(Boolean).slice(0, 2).join(", ") ||
    "Not listed";
  const accepted =
    input.certifiedBy?.trim() ||
    input.certificationLevel?.trim() ||
    "Not listed";

  const tx = 240;
  let ty = 170;
  const label = (text: string) => {
    ctx.fillStyle = "#737373";
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(text.toUpperCase(), tx, ty);
    ty += 24;
  };
  const value = (text: string, size = 22) => {
    ctx.fillStyle = "#171717";
    ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    wrapText(ctx, text, tx, ty, W - tx - 60, size + 4, 2);
    ty += size + 28;
  };

  label("Referee ID");
  value(input.gotrefsId, 26);
  label("Certified sports");
  value(sportsLabel, 20);
  label("City");
  value(city, 20);
  label("Accepted by");
  value(accepted, 20);

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(
    input.validThrough ? `Valid through ${input.validThrough}` : "GotREFS verified official",
    36,
    H - 36
  );
  ctx.fillText("gotrefs.org", W - 140, H - 36);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 1)
  );
  if (!blob) throw new Error("Could not create the ID image.");
  return blob;
}
