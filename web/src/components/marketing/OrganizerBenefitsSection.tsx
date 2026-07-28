import Link from "next/link";
import { BrandName } from "@/components/BrandName";

const ORGANIZER_REASONS = [
  {
    title: "Major Savings",
    description: "No travel expenses, no hassle.",
  },
  {
    title: "Quality Guaranteed",
    description: "Peer reviews keep refs accountable and performing at their best.",
  },
  {
    title: "Tap & Book",
    description: "Secure trusted talent in just a few clicks.",
  },
] as const;

/** For Organizers — full-screen benefits intro. */
export function OrganizerBenefitsSection() {
  return (
    <section
      id="for-organizers"
      data-snap-section
      className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-slate-50 px-4"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="marketing-eyebrow text-[#1b2132]">For Event Organizers</p>
        <h2 className="marketing-headline text-[#1b2132]">Certified Refs. Zero Logistics.</h2>
        <p className="marketing-body">
          Cut the costly per diems, hotel blocks, and meal stipends. <BrandName /> connects you instantly with
          verified, certified, local officials for a small convenience fee.
        </p>

        <h3 className="mt-5 text-base font-black text-[#1b2132] sm:mt-6 sm:text-lg md:text-xl">
          Top 3 Reasons to Join:
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {ORGANIZER_REASONS.map((reason) => (
            <li
              key={reason.title}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4"
            >
              <p className="text-sm font-black text-[#1b2132] sm:text-base md:text-lg">{reason.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:mt-2 sm:text-sm">
                {reason.description}
              </p>
            </li>
          ))}
        </ul>

        <Link href="/auth/signup?role=organizer" className="btn-demo-hero mt-5 inline-flex w-full sm:mt-6 sm:w-auto">
          Post your first event
        </Link>
      </div>
    </section>
  );
}
