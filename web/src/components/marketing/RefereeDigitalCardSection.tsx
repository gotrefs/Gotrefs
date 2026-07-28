import Image from "next/image";
import Link from "next/link";
import { VerificationPartnerBadge } from "@/components/partners/VerificationPartnerBadge";
import { BRAND_NAME } from "@/lib/brand";

const VERIFIED_REF_CARD_SRC = "/gotrefs-verified-ref-card.png";

/** Full-screen digital referee player card showcase. */
export function RefereeDigitalCardSection() {
  return (
    <section className="viewport-screen scroll-mt-[4.25rem] flex flex-col justify-center border-t border-[var(--border)] bg-white px-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <p className="marketing-eyebrow text-[var(--red)]">Verified officials</p>
        <h2 className="marketing-headline-dense max-w-4xl text-[#1b2132]">
          Your digital ref card when you&apos;re verified
        </h2>
        <p className="marketing-body mx-auto max-w-2xl text-center">
          Organizers see at a glance that you&apos;re identity-verified, certified, and ready to work your games.
        </p>
        <div className="relative mt-4 flex h-[min(32svh,240px)] w-full max-w-2xl items-center justify-center sm:mt-5 sm:h-[min(36vh,300px)] md:h-[min(40vh,340px)]">
          <Image
            src={VERIFIED_REF_CARD_SRC}
            alt={`${BRAND_NAME} verified referee digital player card showing front and back with verification badges, sports, and profile details`}
            width={1200}
            height={900}
            className="mx-auto h-full w-full rounded-xl object-contain shadow-2xl ring-1 ring-black/10"
          />
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
