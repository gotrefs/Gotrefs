import Link from "next/link";
import { BrandName } from "@/components/BrandName";

const REFEREE_BENEFITS = [
  {
    title: "Flexible Scheduling",
    description: "Control your availability and work when it fits your lifestyle.",
  },
  {
    title: "Prompt, Reliable Pay",
    description: "Transparent payment tracking and timely payouts.",
  },
  {
    title: "Diverse Game Opportunities",
    description: "Leagues, tournaments, and age groups to grow your experience.",
  },
  {
    title: "User-Friendly Platform",
    description: "Accept assignments, communicate, and manage your calendar on the go.",
  },
  {
    title: "Community & Support",
    description: "A respected network of officials with resources to help you excel.",
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
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">For Referees</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
          Why Join the <BrandName /> Team?
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
          At <BrandName />, we know that great officiating is the backbone of every great game. That&apos;s why
          we&apos;ve built a platform designed entirely around supporting you, streamlining your schedule, and
          maximizing your opportunities — whether you are a seasoned veteran or just starting out.
        </p>

        <p className="mt-5 text-sm font-bold text-[#1b2132]">What You Get When You Sign Up:</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REFEREE_BENEFITS.map((benefit) => (
            <li
              key={benefit.title}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-sm font-bold text-[#1b2132]">{benefit.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{benefit.description}</p>
            </li>
          ))}
        </ul>

        <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-6 inline-flex w-full sm:w-auto">
          Join as a referee
        </Link>
      </div>
    </section>
  );
}
