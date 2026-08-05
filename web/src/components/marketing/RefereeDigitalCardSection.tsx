import Link from "next/link";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { VerificationPartnerBadge } from "@/components/partners/VerificationPartnerBadge";

/** Demo data for the marketing digital-card showcase (matches live GotRefs ID card UI). */
const DEMO_REF = {
  fullName: "Jordan Miles",
  gotrefsId: "GR-2026-4821",
  avatarLabel: "JM",
  primarySport: "Basketball",
  additionalSports: ["Flag Football", "Volleyball"],
  certificationLevel: "NFHS",
  additionalCertificationLevels: ["CIF"],
  certifiedBy: "NFHS / CIF",
  rate: "$45–$65 / hr",
  baseCity: "Los Angeles, CA",
  workRegions: ["Local city", "County-wide"],
  travelRadius: "25",
  availabilitySummary: "Weeknights & weekends",
  validThrough: "2026-2027",
} as const;

/** Full-screen digital referee ID card showcase. */
export function RefereeDigitalCardSection() {
  return (
    <section
      data-snap-section
      className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <p className="marketing-eyebrow text-[var(--red)]">Verified officials</p>
        <h2 className="marketing-headline-dense max-w-4xl text-[#1b2132]">
          Your digital ref card when you&apos;re verified
        </h2>
        <p className="marketing-body mx-auto max-w-2xl text-center">
          Organizers see at a glance that you&apos;re identity-verified, certified, and ready to work your games.
        </p>
        <div className="relative mt-4 flex w-full max-w-[400px] items-center justify-center sm:mt-5">
          <div className="w-full origin-top scale-[0.85] sm:scale-90 md:scale-100">
            <RefereeIdCard
              fullName={DEMO_REF.fullName}
              gotrefsId={DEMO_REF.gotrefsId}
              avatarLabel={DEMO_REF.avatarLabel}
              primarySport={DEMO_REF.primarySport}
              additionalSports={[...DEMO_REF.additionalSports]}
              certificationLevel={DEMO_REF.certificationLevel}
              additionalCertificationLevels={[...DEMO_REF.additionalCertificationLevels]}
              certifiedBy={DEMO_REF.certifiedBy}
              rate={DEMO_REF.rate}
              baseCity={DEMO_REF.baseCity}
              workRegions={[...DEMO_REF.workRegions]}
              travelRadius={DEMO_REF.travelRadius}
              availabilitySummary={DEMO_REF.availabilitySummary}
              govIdUploaded
              certUploaded
              backgroundStatus="clear"
              verificationStatus="approved"
              profileComplete
              validThrough={DEMO_REF.validThrough}
              hideQr
              className="mx-auto shadow-2xl ring-1 ring-black/10"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-center sm:mt-4">
          <VerificationPartnerBadge large />
        </div>
        <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-4 inline-flex w-full sm:mt-5 sm:w-auto">
          Get verified as a ref
        </Link>
      </div>
    </section>
  );
}
