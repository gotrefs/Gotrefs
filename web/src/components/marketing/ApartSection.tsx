import { normalizeBrandInText } from "@/lib/brand";

type ApartItem = {
  icon: string;
  title: string;
  description: string;
};

/** What sets GotRefs apart — full-screen section. */
export function ApartSection({ title, items }: { title: string; items: ApartItem[] }) {
  const displayTitle = normalizeBrandInText(title);

  return (
    <section
      id="features"
      data-snap-section
      className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="marketing-headline text-center text-[#1b2132]">{displayTitle}</h2>
        <div className="mt-6 grid gap-5 sm:mt-8 md:grid-cols-3 md:gap-8">
          {items.map((item) => (
            <div key={item.title} className="text-center md:text-left">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--red-light)] text-base text-[var(--red)] md:mx-0 md:h-11 md:w-11 md:text-lg">
                {item.icon}
              </div>
              <h3 className="mb-2 text-sm font-bold text-[#1b2132] md:text-base">{item.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
