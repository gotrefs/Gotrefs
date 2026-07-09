import Link from "next/link";
import { BrandName } from "@/components/BrandName";

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
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col items-center justify-center border-t border-[var(--border)] bg-slate-50 px-4"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-base font-black uppercase tracking-[0.18em] text-[var(--red)] sm:text-lg sm:tracking-[0.22em]">
          For Referees
        </p>
        <h2 className="mt-3 text-[2.6rem] font-black leading-[1.02] tracking-tight text-[#1b2132] sm:text-5xl md:text-[3.5rem] lg:text-7xl">
          Your Whistle. Your Backyard.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)] md:text-xl md:leading-8">
          Stop chasing gigs across state lines. With <BrandName />, local event organizers come directly to you. Sleep
          in your own bed, call the games you love, and own your home turf.
        </p>

        <h3 className="mt-8 text-xl font-black text-[#1b2132] md:text-2xl">Top 3 Reasons to Join:</h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {REFEREE_REASONS.map((reason) => (
            <li
              key={reason.title}
              className="rounded-xl border border-[var(--border)] bg-white px-5 py-5 shadow-sm"
            >
              <p className="text-base font-black text-[#1b2132] md:text-xl">{reason.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] md:text-base md:leading-7">
                {reason.description}
              </p>
            </li>
          ))}
        </ul>

        <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-8 inline-flex w-full sm:w-auto">
          Join as a referee
        </Link>
      </div>
    </section>
  );
}
