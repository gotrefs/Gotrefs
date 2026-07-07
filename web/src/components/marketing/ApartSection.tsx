import { normalizeBrandInText } from "@/lib/brand";

type ApartItem = {
  icon: string;
  title: string;
  description: string;
};

/** What sets GotREFS apart — full-screen section. */
export function ApartSection({ title, items }: { title: string; items: ApartItem[] }) {
  const displayTitle = normalizeBrandInText(title);

  return (
    <section
      id="features"
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col items-center justify-center border-t border-[var(--border)] bg-white px-4"
    >
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-wide text-[#1b2132] md:text-3xl">
          {displayTitle}
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
          {items.map((item) => (
            <div key={item.title} className="text-center md:text-left">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--red-light)] text-lg text-[var(--red)] md:mx-0">
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
