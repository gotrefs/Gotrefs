import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrganizerQuickSignupForm } from "@/components/join/OrganizerQuickSignupForm";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Create your organizer account | ${BRAND_NAME}`,
  description: "Sign up in under a minute. No card needed until you book a ref.",
};
export const dynamic = "force-dynamic";

/** Only same-site paths are allowed as a post-signup destination. */
function safeNext(value: string | string[] | undefined): string | null {
  const next = typeof value === "string" ? value : null;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default async function OrganizerSignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);

  // Already signed in: nothing to sign up for.
  let destination: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: member } = await supabase.from("members").select("role").eq("id", user.id).maybeSingle();
      destination = next ?? (member?.role === "organizer" ? "/find-refs" : "/dashboard/referee");
    }
  } catch {
    // Auth unavailable: just show the form.
  }
  if (destination) redirect(destination);

  return (
    <>
      <MarketingHeader />
      <main className="min-h-dvh bg-neutral-50 px-4 py-10 sm:py-16">
        <OrganizerQuickSignupForm next={next} />
      </main>
    </>
  );
}
