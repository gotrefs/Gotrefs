import type { Metadata } from "next";
import { FindRefsExplorer } from "@/components/find-refs/FindRefsExplorer";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { BRAND_NAME } from "@/lib/brand";
import { loadPublicRefListings, type PublicRefListing } from "@/lib/marketplace/public-refs";

export const metadata: Metadata = {
  title: `Find REFerees near you | ${BRAND_NAME}`,
  description: "Browse REFerees by sport, location and rate. No account needed until you book.",
};

export const revalidate = 300;

export default async function FindRefsPage() {
  let refs: PublicRefListing[] = [];
  try {
    refs = await loadPublicRefListings();
  } catch (err) {
    console.error("[find-refs]", err instanceof Error ? err.message : err);
  }

  return (
    <>
      <MarketingHeader />
      <main className="min-h-dvh bg-white">
        <FindRefsExplorer refs={refs} />
      </main>
    </>
  );
}
