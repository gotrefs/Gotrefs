import Link from "next/link";
import { BrandName } from "@/components/BrandName";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";

const ORGANIZER_BENEFITS = [
  {
    title: "Vetted, Quality Officials",
    description: "Instant access to certified, dependable referees and umpires across sports and skill levels.",
  },
  {
    title: "Effortless Assigning",
    description: "Ditch spreadsheets and group texts — assign, track, and manage officials in a few clicks.",
  },
  {
    title: "Automated Scheduling & Updates",
    description: "Real-time alerts for schedule changes, rainouts, and venue updates to reduce no-shows.",
  },
  {
    title: "Simplified Payments",
    description: "Secure, transparent payouts built directly into the platform.",
  },
  {
    title: "Dedicated Support",
    description: "Focus on your event while we handle officiating logistics behind the scenes.",
  },
] as const;

/** For Organizers — benefits intro with organizer profile preview below (one viewport). */
export function OrganizerBenefitsSection() {
  return (
    <section
      id="for-organizers"
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col justify-center border-t border-[var(--border)] bg-slate-50 px-4 py-6 md:py-8"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">For Organizers</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
            Streamline Your Event Officiating with <BrandName />
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
            Running a successful league or tournament requires flawless execution, and nothing impacts the quality of
            your event quite like the officiating. <BrandName /> takes the stress out of assigning, managing, and paying
            officials. We connect you with a network of qualified, reliable referees while providing the digital tools
            you need to keep your games running smoothly and on schedule.
          </p>

          <p className="mt-4 text-sm font-bold text-[#1b2132] md:mt-5">Why Organizers Partner with Us:</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ORGANIZER_BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 shadow-sm"
              >
                <p className="text-sm font-bold text-[#1b2132]">{benefit.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{benefit.description}</p>
              </li>
            ))}
          </ul>

          <Link
            href="/auth/signup?role=organizer"
            className="btn-demo-hero mt-4 inline-flex w-full sm:mt-5 sm:w-auto"
          >
            Post your first event
          </Link>
        </div>

        <div className="mx-auto w-full max-w-lg">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Your organizer dashboard profile
          </p>
          <OrganizerIdCard
            organizationName="Metro Youth Basketball"
            contactName="Jordan Lee"
            email="organizer@example.com"
            primarySport="Basketball"
            additionalSports={["Volleyball"]}
            typicalPay="45"
            bio="Weekend tournaments and seasonal league play across the metro area."
            eventsCount={3}
            idUploaded
            logoUploaded
          />
        </div>
      </div>
    </section>
  );
}
