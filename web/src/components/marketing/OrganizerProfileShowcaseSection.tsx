import Link from "next/link";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";

/** Full-screen organizer dashboard profile preview. */
export function OrganizerProfileShowcaseSection() {
  return (
    <section className="viewport-screen flex flex-col items-center justify-center border-t border-[var(--border)] bg-white px-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center">
        <p className="text-center text-base font-black uppercase tracking-[0.18em] text-[var(--red)] sm:text-lg sm:tracking-[0.22em]">
          For Organizers
        </p>
        <h2 className="mt-3 text-center text-[2.6rem] font-black leading-[1.02] tracking-tight text-[#1b2132] sm:text-5xl md:text-[3.5rem] lg:text-7xl">
          Your organizer dashboard profile
        </h2>
        <p className="mt-4 max-w-2xl text-center text-base leading-7 text-[var(--muted)] md:text-xl md:leading-8">
          Post events, set pay rates, and manage staffing from one profile organizers and refs can trust.
        </p>
        <div className="mt-8 w-full max-w-lg">
          <OrganizerIdCard
            organizationName="Metro Youth Basketball"
            contactName="Jordan Lee"
            email="organizer@example.com"
            primarySport="Basketball"
            additionalSports={["Volleyball"]}
            typicalPay="45"
            bio="Weekend tournaments and seasonal league play across the metro area."
            eventsCount={3}
            logoUploaded
            brandHexPrimary="#0D1B2A"
            brandHexSecondary="#7F1D1D"
          />
        </div>
        <Link href="/auth/signup?role=organizer" className="btn-demo-hero mt-8 inline-flex w-full sm:w-auto">
          Create organizer profile
        </Link>
      </div>
    </section>
  );
}
