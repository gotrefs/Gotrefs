import Link from "next/link";
import type { Metadata } from "next";
import { RequestRefForm } from "@/components/find-refs/RequestRefForm";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { BRAND_NAME } from "@/lib/brand";
import { loadPublicRefListings } from "@/lib/marketplace/public-refs";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ gotrefsId: string }> };

export const metadata: Metadata = { title: `Request a referee | ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

async function viewerRole(): Promise<"organizer" | "ref" | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("members").select("role").eq("id", user.id).maybeSingle();
    return data?.role === "organizer" ? "organizer" : "ref";
  } catch {
    return null;
  }
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-neutral-600">{body}</p>
      <Link href="/find-refs" className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
        Browse refs
      </Link>
    </div>
  );
}

export default async function RequestRefPage({ params }: PageProps) {
  const { gotrefsId } = await params;
  const id = decodeURIComponent(gotrefsId).trim().toUpperCase();

  let refs: Awaited<ReturnType<typeof loadPublicRefListings>> = [];
  try {
    refs = await loadPublicRefListings();
  } catch (err) {
    console.error("[find-refs/request]", err instanceof Error ? err.message : err);
  }
  const listing = refs.find((r) => r.gotrefsId.toUpperCase() === id);
  const role = await viewerRole();

  return (
    <>
      <MarketingHeader />
      <main className="min-h-dvh bg-white">
        {!listing ? (
          <Notice title="Ref not found" body="This referee isn't available right now. Browse other refs near you." />
        ) : listing.isSample ? (
          <Notice
            title="This is a sample profile"
            body="Sample profiles show what GoTRefs listings look like and can't be requested. Browse verified refs instead."
          />
        ) : (
          <RequestRefForm listing={listing} viewerRole={role} />
        )}
      </main>
    </>
  );
}
