import Link from "next/link";
import { BrandName } from "@/components/BrandName";
import { RefGearPerkCard } from "@/components/partners/RefGearPerkCard";

const REFEREE_REASONS = [
  {
    title: "$0 to Join",
    description: "Always 100% free for officials.",
  },
  {
    title: "Zero Travel",
    description: "No flights, no hotels, no road fatigue.",
  },
  {
    title: "Instant Bookings",
    description: "Organizers reach out to you directly.",
  },
] as const;

/** For Referees — full-screen benefits intro. */
export function VerifiedRefCardSection() {
  return (
    <section
      id="ref-verification"
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col justify-center border-t border-[var(--border)] bg-slate-50 px-4"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center">
        <p className="marketing-eyebrow text-[var(--red)]">For Referees</p>
        <h2 className="marketing-headline text-[#1b2132]">Your Whistle. Your Backyard.</h2>
        <p className="marketing-body">
          Stop chasing gigs across state lines. With <BrandName />, local event organizers come directly to you. Sleep
          in your own bed, call the games you love, and own your home turf.
        </p>

        <h3 className="mt-5 text-base font-black text-[#1b2132] sm:mt-6 sm:text-lg md:text-xl">
          Top 3 Reasons to Join:
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {REFEREE_REASONS.map((reason) => (
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

        <div className="mt-4 sm:mt-5">
          <RefGearPerkCard unlocked compact />
        </div>

        <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-5 inline-flex w-full sm:mt-6 sm:w-auto">
          Join as a referee
        </Link>
      </div>
    </section>
  );
}
