import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ gotrefsId: string }> };

/**
 * Legacy /id/{GotREFS-ID} links redirect straight to the inline PDF
 * so organizers always land in a phone PDF viewer.
 */
export default async function PublicRefIdPage({ params }: PageProps) {
  const { gotrefsId } = await params;
  const id = decodeURIComponent(gotrefsId || "").trim();
  if (!id) {
    redirect("/");
  }
  redirect(`/api/id/${encodeURIComponent(id)}/pdf`);
}
