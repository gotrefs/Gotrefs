import { normalizeBrandInText } from "@/lib/brand";

type ApartItem = {
  icon: string;
  title: string;
  description: string;
};

/** Screen 3 — what sets GotREFS apart (one viewport). */
export function ApartSection({ title, items }: { title: string; items: ApartItem[] }) {
  const displayTitle = normalizeBrandInText(title);

  return (
    <section className="viewport-screen flex flex-col justify-center border-t border-[var(--border)] bg-white px-4">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="mb-6 text-center text-xl font-bold tracking-wide text-[#1b2132] md:mb-8 md:text-2xl lg:text-3xl">
          {displayTitle}
        </h2>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {items.map((item) => (
            <div key={item.title} className="text-center md:text-left">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--red-light)] text-lg text-[var(--red)] md:mx-0">
                {item.icon}
              </div>
              <h3 className="mb-2 text-sm font-bold uppercase text-[#1b2132] md:text-base">{item.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--muted)] md:text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
