import { VerifyOfficialClient, VerifyOfficialNotFound } from "@/components/VerifyOfficialClient";
import { loadPublicRefIdCard, normalizeGotrefsId } from "@/lib/public-ref-id-card";
import type { Metadata } from "next";

type PageProps = { params: Promise<{ refereeId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { refereeId } = await params;
  const id = normalizeGotrefsId(refereeId || "");
  return {
    title: id ? `GotREFS Verified Official · ${id}` : "GotREFS Verified Official",
    description: "Scan-verified GotREFS official ID card.",
    robots: { index: false, follow: false },
  };
}

/**
 * QR scan destination: public verified-official page.
 * Loads referee data by GotREFS ID — no login required.
 */
export default async function VerifyRefereePage({ params }: PageProps) {
  const { refereeId } = await params;
  const id = normalizeGotrefsId(refereeId || "");
  if (!id) {
    return <VerifyOfficialNotFound id="—" />;
  }

  try {
    const card = await loadPublicRefIdCard(id);
    if (!card) {
      return <VerifyOfficialNotFound id={id} />;
    }
    return <VerifyOfficialClient card={card} />;
  } catch {
    return <VerifyOfficialNotFound id={id} />;
  }
}
