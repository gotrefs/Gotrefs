import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinProviderButtons } from "@/components/join/JoinProviderButtons";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { isOAuthProviderEnabled } from "@/lib/auth/oauth-provider-flags";
import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Join as a referee | ${BRAND_NAME}`,
  description: "Sign up in seconds with Google and find local games to referee.",
};
export const dynamic = "force-dynamic";

const STEPS = [
  ["Sign up in seconds", "Continue with Google, then tell us your name and sport."],
  ["Find local games", "Browse open games near you on the map."],
  ["Get verified to work", "When you request your first game, add a photo, ID and certification."],
];

export default async function JoinPage() {
  // Already signed in: skip straight to the right place.
  let destination: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: member } = await supabase
        .from("members")
        .select("is_onboarded, role")
        .eq("id", user.id)
        .maybeSingle();
      destination = !member?.is_onboarded
        ? "/join/finish"
        : member.role === "organizer"
          ? "/dashboard/organizer"
          : "/dashboard/referee";
    }
  } catch {
    // Auth unavailable: just show the page.
  }
  if (destination) redirect(destination);

  const enabled = { google: isOAuthProviderEnabled("google"), apple: isOAuthProviderEnabled("apple") };

  return (
    <>
      <MarketingHeader />
      <main className="min-h-dvh bg-neutral-50 px-4 py-12 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--red)]">For referees</p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-[var(--navy)] sm:text-5xl">
              Ref more games near you.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-neutral-600">
              Join {BRAND_NAME} free, see games in your area, and get paid through the app.
            </p>
            <ol className="mt-8 space-y-5">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-sm font-black text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">{title}</p>
                    <p className="text-sm text-neutral-600">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl bg-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-8">
            <h2 className="text-2xl font-semibold text-neutral-900">Create your referee account</h2>
            <p className="mt-1 text-sm text-neutral-600">Free. Takes about 30 seconds.</p>
            <div className="mt-6">
              <JoinProviderButtons enabled={enabled} />
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />
              or
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <Link
              href="/auth/signup?role=ref"
              className="block w-full rounded-xl border border-neutral-300 px-4 py-3.5 text-center text-[15px] font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Sign up with email
            </Link>
            <p className="mt-6 text-center text-sm text-neutral-600">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-semibold text-neutral-900 underline">
                Log in
              </Link>
            </p>
            <p className="mt-4 text-center text-sm text-neutral-600">
              Hiring refs instead?{" "}
              <Link href="/find-refs" className="font-semibold text-neutral-900 underline">
                Find refs
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
