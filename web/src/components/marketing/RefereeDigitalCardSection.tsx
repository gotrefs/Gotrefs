import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

const VERIFIED_REF_CARD_SRC = "/gotrefs-verified-ref-card.png";

/** Full-screen digital referee player card showcase. */
export function RefereeDigitalCardSection() {
  return (
    <section className="viewport-screen flex flex-col items-center justify-center border-t border-[var(--border)] bg-white px-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">Verified officials</p>
        <h2 className="mt-2 max-w-2xl text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl">
          Your digital ref card when you&apos;re verified
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
          Organizers see at a glance that you&apos;re identity-verified, certified, and ready to work your games.
        </p>
        <div className="relative mt-6 w-full max-w-3xl flex-1">
          <Image
            src={VERIFIED_REF_CARD_SRC}
            alt={`${BRAND_NAME} verified referee digital player card showing front and back with verification badges, sports, and profile details`}
            width={1200}
            height={900}
            className="mx-auto h-full max-h-[min(52vh,calc(100svh-18rem))] w-full rounded-xl object-contain shadow-2xl ring-1 ring-black/10"
          />
        </div>
        <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-6 inline-flex w-full sm:w-auto">
          Get verified as a ref
        </Link>
      </div>
    </section>
  );
}
