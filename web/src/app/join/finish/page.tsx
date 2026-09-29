import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuickRefFinishForm } from "@/components/join/QuickRefFinishForm";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PRIMARY_SPORTS } from "@/data/sports";
import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Finish signing up | ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export default async function JoinFinishPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: member } = await supabase
    .from("members")
    .select("is_onboarded, role, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  if (member?.is_onboarded) {
    redirect(member.role === "organizer" ? "/dashboard/organizer" : "/dashboard/referee");
  }

  // Prefill from what Google / Apple shared.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromFull = splitName(
    typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : ""
  );
  const firstName =
    member?.first_name || (typeof meta.given_name === "string" ? meta.given_name : "") || fromFull.first;
  const lastName =
    member?.last_name || (typeof meta.family_name === "string" ? meta.family_name : "") || fromFull.last;

  return (
    <>
      <MarketingHeader />
      <main className="min-h-dvh bg-neutral-50 px-4 py-12 sm:py-20">
        <QuickRefFinishForm
          initialFirstName={firstName}
          initialLastName={lastName}
          email={user.email ?? ""}
          sports={[...PRIMARY_SPORTS]}
        />
      </main>
    </>
  );
}
