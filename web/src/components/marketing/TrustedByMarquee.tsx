/* eslint-disable @next/next/no-img-element */

type Partner = { name: string; src: string; width: number; height: number };

/** Programs shown in the "Trusted by" strip, in display order. Add new logos to web/public/partners/trusted/. */
const PARTNERS: Partner[] = [
  { name: "Shook", src: "/partners/trusted/shook.png", width: 335, height: 160 },
  { name: "Premier Events", src: "/partners/trusted/premier-events.png", width: 174, height: 160 },
  { name: "Aces Basketball", src: "/partners/trusted/aces-basketball.png", width: 269, height: 160 },
];

// Repeat the set so one half of the track is always wider than the screen.
const REPEATS = 4;

function LogoRow({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="trusted-marquee-row" aria-hidden={hidden || undefined}>
      {Array.from({ length: REPEATS }).flatMap((_, r) =>
        PARTNERS.map((p) => (
          <li key={`${r}-${p.name}`} className="trusted-marquee-item">
            <img
              src={p.src}
              alt={hidden || r > 0 ? "" : p.name}
              width={p.width}
              height={p.height}
              loading="lazy"
              decoding="async"
              className="h-12 w-auto sm:h-16"
            />
          </li>
        ))
      )}
    </ul>
  );
}

/** "Trusted by programs nationwide" strip: logos scroll right to left in a loop. */
export function TrustedByMarquee() {
  return (
    <section aria-label="Trusted by programs nationwide" className="shrink-0 border-t border-white/10 bg-white py-4 sm:py-5">
      <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-[#1b2132] sm:text-sm">
        Trusted by programs nationwide
      </p>
      <div className="trusted-marquee mt-3 sm:mt-4">
        <div className="trusted-marquee-track">
          <LogoRow />
          <LogoRow hidden />
        </div>
      </div>
    </section>
  );
}
