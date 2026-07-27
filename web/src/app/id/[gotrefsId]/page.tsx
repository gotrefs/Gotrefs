import { redirect } from "next/navigation";
import { normalizeGotrefsId } from "@/lib/public-ref-id-card";

type PageProps = { params: Promise<{ gotrefsId: string }> };

/** Legacy /id/{id} links redirect to the verify page used by QR scans. */
export default async function LegacyPublicRefIdPage({ params }: PageProps) {
  const { gotrefsId } = await params;
  const id = normalizeGotrefsId(gotrefsId || "");
  if (!id) redirect("/");
  redirect(`/verify/${encodeURIComponent(id)}`);
}
