import Link from "next/link";

/** Second home screen: one-click path to the public Find Refs marketplace. */
export function FindRefsNowSection() {
  return (
    <section
      id="find-refs"
      data-snap-section
      className="viewport-screen flex flex-col border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col items-center gap-5 lg:flex-row lg:gap-12">
        <div className="shrink-0 text-center lg:flex-1 lg:text-left">
          <p className="marketing-eyebrow text-[var(--red)]">For Organizers</p>
          <h2 className="marketing-headline text-[#1b2132]">Find REFS Near You</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-600 md:text-base lg:mx-0">
            Browse officials by sport, rate and distance on the map. No account needed to look.
          </p>
          <Link
            href="/find-refs"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--red)] px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[var(--red-dark)] sm:mt-6 sm:px-10 sm:py-4 sm:text-lg"
          >
            Find REFS Now <span aria-hidden>→</span>
          </Link>
        </div>

        <Link
          href="/find-refs"
          aria-label="Open Find REFS"
          className="group flex min-h-0 w-full flex-1 items-center justify-center lg:h-full lg:w-auto lg:flex-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/we-gotrefs-poster.jpg"
            alt="We GotREFS poster: the REFeree marketplace for every sport"
            width={1107}
            height={1421}
            loading="lazy"
            className="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain lg:h-full shadow-[0_20px_60px_rgba(15,23,42,0.22)] transition duration-300 group-hover:scale-[1.01]"
          />
        </Link>
      </div>
    </section>
  );
}
