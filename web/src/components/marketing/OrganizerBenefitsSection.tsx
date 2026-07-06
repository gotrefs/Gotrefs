import Link from "next/link";
import { BrandName } from "@/components/BrandName";

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

/** For Organizers — full-screen benefits intro. */
export function OrganizerBenefitsSection() {
  return (
    <section
      id="for-organizers"
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col items-center justify-center border-t border-[var(--border)] bg-slate-50 px-4"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">For Organizers</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
          Streamline Your Event Officiating with <BrandName />
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
          Running a successful league or tournament requires flawless execution, and nothing impacts the quality of
          your event quite like the officiating. <BrandName /> takes the stress out of assigning, managing, and paying
          officials while keeping your games running smoothly and on schedule.
        </p>

        <p className="mt-5 text-sm font-bold text-[#1b2132]">Why Organizers Partner with Us:</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORGANIZER_BENEFITS.map((benefit) => (
            <li
              key={benefit.title}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-sm font-bold text-[#1b2132]">{benefit.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{benefit.description}</p>
            </li>
          ))}
        </ul>

        <Link href="/auth/signup?role=organizer" className="btn-demo-hero mt-6 inline-flex w-full sm:w-auto">
          Post your first event
        </Link>
      </div>
    </section>
  );
}
