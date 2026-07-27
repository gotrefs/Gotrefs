"use client";

import { domToJpeg } from "modern-screenshot";
import { createClient } from "@/lib/supabase/client";

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
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url || url.startsWith("data:")) return url || null;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "reload" });
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

/**
 * Temporarily swap remote images to data URLs so the face photo / logo
 * survive the screenshot (same pixels as on screen).
 */
async function withInlinedImages<T>(root: HTMLElement, run: () => Promise<T>): Promise<T> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const restores: Array<() => void> = [];

  await Promise.all(
    imgs.map(async (img) => {
      const original = img.currentSrc || img.getAttribute("src") || "";
      if (!original || original.startsWith("data:")) return;
      const dataUrl = await urlToDataUrl(original);
      if (!dataUrl) return;
      const prevSrc = img.getAttribute("src");
      const prevSrcset = img.getAttribute("srcset");
      img.removeAttribute("srcset");
      img.src = dataUrl;
      restores.push(() => {
        if (prevSrcset) img.setAttribute("srcset", prevSrcset);
        else img.removeAttribute("srcset");
        if (prevSrc != null) img.setAttribute("src", prevSrc);
        else img.removeAttribute("src");
      });
    })
  );

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  try {
    return await run();
  } finally {
    for (const restore of restores) restore();
  }
}

function findIdCardElement(preferred?: HTMLElement | null): HTMLElement {
  if (preferred && preferred.isConnected) return preferred;
  const found = document.querySelector<HTMLElement>("[data-ref-id-card]");
  if (!found) {
    throw new Error("ID card is not on the page yet.");
  }
  return found;
}

export async function captureRefIdCardJpegDataUrl(cardElement?: HTMLElement | null): Promise<string> {
  const el = findIdCardElement(cardElement);
  el.scrollIntoView({ block: "nearest", inline: "nearest" });

  return withInlinedImages(el, async () =>
    domToJpeg(el, {
      quality: 0.95,
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      backgroundColor: "#020617",
      filter: (node) => {
        if (node instanceof HTMLInputElement) return false;
        if (node instanceof HTMLElement && node.dataset.hideFromIdScan === "true") return false;
        return true;
      },
    })
  );
}

/**
 * Screenshot the live on-screen RefereeIdCard and store it so QR scans
 * open a photo of the card (no login, no dashboard).
 */
export async function publishOfficialIdCardImage(
  memberId: string,
  cardElement?: HTMLElement | null
): Promise<string> {
  const dataUrl = await captureRefIdCardJpegDataUrl(cardElement);
  const blob = dataUrlToBlob(dataUrl);
  const path = `${memberId}/official_id_card.jpg`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("verification_documents").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "60",
  });
  if (error) throw error;
  return path;
}

/**
 * Screenshot the live on-screen RefereeIdCard (not a redraw / PDF clone)
 * so the JPEG matches exactly what the ref sees.
 */
export async function downloadRefIdCardJpeg(
  filename: string,
  cardElement?: HTMLElement | null
): Promise<void> {
  const dataUrl = await captureRefIdCardJpegDataUrl(cardElement);
  triggerBlobDownload(dataUrlToBlob(dataUrl), filename);
}
