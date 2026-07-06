import { BrandName } from "@/components/BrandName";
import { PolicyLinksPanel } from "./PolicyLinksPanel";

/** Policies — all legal and program documents (homepage section). */
export function PolicySection() {
  return (
    <section
      id="policies"
      className="scroll-mt-[4.25rem] border-t border-[var(--border)] bg-slate-50 px-4 py-10 md:py-12"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--red)]">Legal & program</p>
        <h2 className="mt-2 text-2xl font-bold text-[#1b2132] md:text-3xl">
          <BrandName /> Policies
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
          Review our background check standards, community guidelines, payment policies, privacy terms, and verified
          program details. Click any document to read the full text.
        </p>
        <div className="mt-6">
          <PolicyLinksPanel variant="section" />
        </div>
      </div>
    </section>
  );
}
