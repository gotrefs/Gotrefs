import Link from "next/link";
import { OrganizerIdCard } from "@/components/OrganizerIdCard";

/** Full-screen organizer dashboard profile preview. */
export function OrganizerProfileShowcaseSection() {
  return (
    <section
      data-snap-section
      className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <p className="marketing-eyebrow text-[var(--red)]">For Organizers</p>
        <h2 className="marketing-headline-dense max-w-4xl text-[#1b2132]">Your organizer dashboard profile</h2>
        <p className="marketing-body mx-auto max-w-2xl text-center">
          Post events, set pay rates, and manage staffing from one profile organizers and refs can trust.
        </p>
        <div className="mt-4 flex h-[min(38svh,300px)] w-full max-w-md items-start justify-center overflow-hidden sm:mt-5 sm:h-[min(42vh,340px)] md:max-w-lg">
          <div className="w-full origin-top scale-[0.78] sm:scale-[0.85] md:scale-90">
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
        </div>
        <Link href="/auth/signup?role=organizer" className="btn-demo-hero mt-4 inline-flex w-full sm:mt-5 sm:w-auto">
          Create organizer profile
        </Link>
      </div>
    </section>
  );
}
