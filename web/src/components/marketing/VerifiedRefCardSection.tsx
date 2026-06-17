import Image from "next/image";
import Link from "next/link";

const VERIFIED_REF_CARD_SRC = "/gotrefs-verified-ref-card.png";

/** Screen 2 — verified ref digital player card (replaces stats + See How video). */
export function VerifiedRefCardSection() {
  return (
    <section
      className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4"
      id="features"
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">Verified officials</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-[#1b2132] md:text-3xl lg:text-4xl">
            Your digital ref ID when you&apos;re verified
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] md:text-base">
            Every verified referee on GotREFS receives a digital player card — the same kind of trusted ID used
            in elite sports. Organizers see at a glance that you&apos;re background-checked, identity-verified, and
            certified for the sports you officiate.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-[#1b2132]">
            <li className="flex gap-2">
              <span className="font-bold text-[var(--red)]">✓</span>
              <span>
                <strong>Background checked</strong> — criminal screening through our verification partners
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[var(--red)]">✓</span>
              <span>
                <strong>Identity verified</strong> — government ID and certification on file
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-[var(--red)]">✓</span>
              <span>
                <strong>Game ready</strong> — sports, regions, ratings, and availability on one card
              </span>
            </li>
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Complete your profile, upload your documents, and pass verification — then your card goes live on
            GotREFS for organizers hiring refs they can trust.
          </p>
          <Link href="/auth/signup?role=ref" className="btn-demo-hero mt-6 inline-flex">
            Get verified as a ref
          </Link>
        </div>

        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-xl">
            <Image
              src={VERIFIED_REF_CARD_SRC}
              alt="GotREFS verified referee digital player card showing front and back with verification badges, sports, and profile details"
              width={1200}
              height={900}
              className="h-auto w-full rounded-xl shadow-2xl ring-1 ring-black/10"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
