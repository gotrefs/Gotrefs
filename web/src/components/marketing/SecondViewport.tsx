import Link from "next/link";
import { HeroVideoShowcase } from "./HeroVideoShowcase";
import { StatIcon } from "./StatIcon";

type StatItem = {
  icon: string;
  value: string;
  title: string;
  description: string;
};

/** Stats + See How — fits one viewport below the hero. */
export function SecondViewport({
  statsTitle,
  statsSubtext,
  stats,
  seeHowTitle,
  seeHowBody,
  seeHowCtaLabel,
  seeHowCtaHref,
}: {
  statsTitle: string;
  statsSubtext: string;
  stats: StatItem[];
  seeHowTitle: string;
  seeHowBody: string;
  seeHowCtaLabel: string;
  seeHowCtaHref: string;
}) {
  return (
    <section className="viewport-screen grid grid-rows-[auto_1fr] overflow-hidden bg-white">
      {/* The Numbers That Matter */}
      <div className="bg-white px-4 py-4 md:py-5">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-xl font-bold text-[#1b2132] md:text-2xl">{statsTitle}</h2>
          <p className="mx-auto mt-1.5 max-w-2xl text-center text-xs leading-snug text-[var(--muted)] md:text-sm">
            {statsSubtext}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
            {stats.map((s) => (
              <div key={s.title} className="text-center">
                <div className="mb-1.5 flex justify-center">
                  <StatIcon type={s.icon} className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <p className="text-sm font-bold text-[#1b2132]">{s.value}</p>
                <p className="text-xs font-bold text-[#1b2132]">{s.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--muted)] md:text-xs">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* See How GotREFS Works */}
      <div className="min-h-0 overflow-hidden bg-white px-4 py-4 md:py-5" id="features">
        <div className="mx-auto grid h-full max-w-6xl grid-cols-1 items-center gap-4 lg:grid-cols-2 lg:gap-8">
          <div>
            <h2 className="text-lg font-bold leading-tight text-[#1b2132] md:text-2xl lg:text-3xl">
              {seeHowTitle}
            </h2>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted)] md:line-clamp-4 md:text-sm">
              {seeHowBody}
            </p>
            <Link href={seeHowCtaHref} className="btn-demo-hero mt-3 w-fit px-5 py-2 text-sm">
              {seeHowCtaLabel}
            </Link>
          </div>
          <div className="flex h-full min-h-0 items-center justify-center">
            <HeroVideoShowcase
              fitContainer
              showCaption
              caption="CERTIFIED. BACKGROUND-CHECKED. READY TO WORK."
              className="h-full w-full max-h-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
