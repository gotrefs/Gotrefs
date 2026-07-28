import Image from "next/image";
import { US_OFFICIALS_SUPPLIES } from "@/lib/partners";

type RefGearPerkCardProps = {
  unlocked?: boolean;
  showCoupon?: boolean;
  /** Tighter layout for full-viewport marketing panels. */
  compact?: boolean;
  className?: string;
};

/** U.S. Officials Supplies member gear perk for marketing, signup, and ref dashboard. */
export function RefGearPerkCard({
  unlocked = true,
  showCoupon = false,
  compact = false,
  className = "",
}: RefGearPerkCardProps) {
  const partner = US_OFFICIALS_SUPPLIES;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm ${className}`}
    >
      <div
        className={`flex flex-col sm:flex-row sm:items-center ${
          compact ? "gap-3 p-3 sm:gap-4 sm:p-3.5" : "gap-4 p-4 sm:gap-5 sm:p-5"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200/80 ${
            compact ? "h-12 w-20" : "h-16 w-28"
          }`}
        >
          <Image
            src={partner.logoSrc}
            alt={partner.name}
            width={112}
            height={64}
            className={compact ? "h-10 w-auto object-contain" : "h-14 w-auto object-contain"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--red)]">Member perk</p>
          <p
            className={`mt-0.5 font-display font-black text-[var(--navy)] ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {partner.discountLabel} at {partner.name}
          </p>
          {!compact && <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{partner.blurb}</p>}
          {!unlocked && (
            <p className="mt-1 text-xs font-semibold text-amber-800">
              Unlock this discount after you finish creating your GotRefs account.
            </p>
          )}
          {unlocked && showCoupon && partner.couponCode && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-[var(--navy)]">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">Code</span>
              <span className="font-black tracking-wide">{partner.couponCode}</span>
              <span className="text-xs font-medium text-[var(--muted)]">— enter at checkout</span>
            </p>
          )}
        </div>
        {unlocked ? (
          <a
            href={partner.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-sm font-black text-white hover:opacity-90 ${
              compact ? "px-4 py-2" : "px-5 py-2.5"
            }`}
          >
            Shop gear
          </a>
        ) : (
          <span className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm font-bold text-slate-400">
            Locked
          </span>
        )}
      </div>
    </div>
  );
}
