import Image from "next/image";
import Link from "next/link";
import { BrandName } from "@/components/BrandName";
import { BRAND_NAME } from "@/lib/brand";

const VERIFIED_REF_CARD_SRC = "/gotrefs-verified-ref-card.png";

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

/** For Referees — benefits intro with digital player card below (one viewport). */
export function VerifiedRefCardSection() {
  return (
    <section
      id="ref-verification"
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col justify-center border-t border-[var(--border)] bg-white px-4 py-6 md:py-8"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 md:gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">For Referees</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
            Why Join the <BrandName /> Team?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
            At <BrandName />, we know that great officiating is the backbone of every great game. That&apos;s why
            we&apos;ve built a platform designed entirely around supporting you, streamlining your schedule, and
            maximizing your opportunities. Whether you are a seasoned veteran or just starting your officiating
            journey, joining our network connects you with the games you want, when you want them.
          </p>

          <p className="mt-4 text-sm font-bold text-[#1b2132] md:mt-5">What You Get When You Sign Up:</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {REFEREE_BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--grey-light)]/40 px-3 py-2.5"
              >
                <p className="text-sm font-bold text-[#1b2132]">{benefit.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{benefit.description}</p>
              </li>
            ))}
          </ul>

          <Link
            href="/auth/signup?role=ref"
            className="btn-demo-hero mt-4 inline-flex w-full sm:mt-5 sm:w-auto"
          >
            Join as a referee
          </Link>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            Your digital ref card when you&apos;re verified
          </p>
          <div className="relative mt-3 w-full max-w-2xl">
            <Image
              src={VERIFIED_REF_CARD_SRC}
              alt={`${BRAND_NAME} verified referee digital player card showing front and back with verification badges, sports, and profile details`}
              width={1200}
              height={900}
              className="mx-auto h-auto max-h-[28vh] w-full rounded-xl object-contain shadow-2xl ring-1 ring-black/10 sm:max-h-[34vh] md:max-h-[38vh]"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
