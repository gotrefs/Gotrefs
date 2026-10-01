import Link from "next/link";

/** Second home screen: one-click path to the public Find Refs marketplace. */
export function FindRefsNowSection() {
  return (
    <section
      id="find-refs"
      data-snap-section
      className="viewport-screen flex flex-col border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col items-center">
        <div className="shrink-0 text-center">
          <p className="marketing-eyebrow text-[var(--red)]">For Organizers</p>
          <h2 className="marketing-headline text-[#1b2132]">Find Refs Near You</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-600 md:text-base">
            Browse officials by sport, rate and distance on the map. No account needed to look.
          </p>
          <Link
            href="/find-refs"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--red)] px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[var(--red-dark)] sm:mt-6 sm:px-10 sm:py-4 sm:text-lg"
          >
            Find Refs Now <span aria-hidden>→</span>
          </Link>
        </div>

        <Link
          href="/find-refs"
          aria-label="Open Find Refs"
          className="group mt-6 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] transition hover:shadow-[0_24px_70px_rgba(15,23,42,0.26)] sm:mt-8"
        >
          <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-xs text-neutral-500">gotrefs.org/find-refs</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marketing/find-refs-screenshot.jpg"
            alt="The GoTRefs Find Refs page: filters, referee listings and a map"
            width={1400}
            height={788}
            loading="lazy"
            className="min-h-0 w-full flex-1 object-cover object-left-top transition duration-300 group-hover:scale-[1.01]"
          />
        </Link>
      </div>
    </section>
  );
}
