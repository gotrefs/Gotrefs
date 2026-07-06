import Link from "next/link";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";

/** Full-screen organizer dashboard profile preview. */
export function OrganizerProfileShowcaseSection() {
  return (
    <section className="viewport-screen flex flex-col items-center justify-center border-t border-[var(--border)] bg-white px-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--red)]">For Organizers</p>
        <h2 className="mt-2 text-center text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
          Your organizer dashboard profile
        </h2>
        <p className="mt-2 max-w-xl text-center text-sm leading-relaxed text-[var(--muted)]">
          Post events, set pay rates, and manage staffing from one profile organizers and refs can trust.
        </p>
        <div className="mt-6 w-full max-w-lg">
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
        <Link href="/auth/signup?role=organizer" className="btn-demo-hero mt-6 inline-flex w-full sm:w-auto">
          Create organizer profile
        </Link>
      </div>
    </section>
  );
}
