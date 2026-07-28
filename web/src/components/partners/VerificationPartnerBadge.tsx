import Image from "next/image";
import { NATIONAL_SPORTSID } from "@/lib/partners";

type VerificationPartnerBadgeProps = {
  /** Compact = logo + short label; default includes partner blurb. */
  compact?: boolean;
  /** Large logo for the marketing digital-card section. */
  large?: boolean;
  className?: string;
};

/** Quiet “verification partner” mark for marketing + pending ref dashboard. */
export function VerificationPartnerBadge({
  compact = false,
  large = false,
  className = "",
}: VerificationPartnerBadgeProps) {
  const logoWidth = large ? 180 : compact ? 120 : 148;
  const logoHeight = large ? 56 : compact ? 40 : 48;
  const logoClass = large
    ? "h-10 w-auto object-contain sm:h-12"
    : compact
      ? "h-8 w-auto object-contain sm:h-9"
      : "h-10 w-auto object-contain sm:h-12";

  return (
    <a
      href={NATIONAL_SPORTSID.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white/90 transition hover:border-[var(--navy)]/30 ${
        large ? "gap-3 px-3 py-2" : "px-3 py-2"
      } ${className}`}
    >
      <Image
        src={NATIONAL_SPORTSID.logoSrc}
        alt={NATIONAL_SPORTSID.name}
        width={logoWidth}
        height={logoHeight}
        className={logoClass}
      />
      <span className="text-left">
        <span
          className={`block font-black uppercase tracking-[0.16em] text-[var(--muted)] ${
            large ? "text-xs sm:text-sm" : "text-[10px]"
          }`}
        >
          Verification partner
        </span>
        {!compact && (
          <span
            className={`mt-0.5 block leading-snug text-[var(--slate)] ${
              large ? "max-w-[14rem] text-xs" : "max-w-[14rem] text-xs"
            }`}
          >
            {NATIONAL_SPORTSID.blurb}
          </span>
        )}
        {compact && (
          <span className="mt-0.5 block text-xs font-semibold text-[var(--navy)]">{NATIONAL_SPORTSID.name}</span>
        )}
      </span>
    </a>
  );
}
