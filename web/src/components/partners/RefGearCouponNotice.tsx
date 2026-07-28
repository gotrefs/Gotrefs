import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";
import { US_OFFICIALS_SUPPLIES } from "@/lib/partners";

type RefGearCouponNoticeProps = {
  className?: string;
};

/** Shown on the ref dashboard after email is confirmed. */
export function RefGearCouponNotice({ className = "" }: RefGearCouponNoticeProps) {
  const partner = US_OFFICIALS_SUPPLIES;
  const code = partner.couponCode;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:gap-4 ${className}`}
    >
      <div className="flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-amber-200/80">
        <Image
          src={partner.logoSrc}
          alt={partner.name}
          width={112}
          height={64}
          className="h-12 w-auto object-contain"
        />
      </div>
      <div className="min-w-0 text-sm leading-6 text-[var(--navy)]">
        <p className="font-semibold">
          Use{" "}
          <span className="font-black tracking-wide">{code}</span> at checkout for {partner.discountLabel} at{" "}
          {partner.name}.
        </p>
        <p className="mt-1 font-medium text-[var(--muted)]">Thank you for signing up with {BRAND_NAME}.</p>
      </div>
    </div>
  );
}

type RefGearDiscountTeaserProps = {
  className?: string;
};

/** Create-account teaser — no code until email is confirmed. */
export function RefGearDiscountTeaser({ className = "" }: RefGearDiscountTeaserProps) {
  const partner = US_OFFICIALS_SUPPLIES;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:gap-4 ${className}`}
    >
      <div className="flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200">
        <Image
          src={partner.logoSrc}
          alt={partner.name}
          width={112}
          height={64}
          className="h-12 w-auto object-contain"
        />
      </div>
      <p className="min-w-0 text-sm leading-6 font-semibold text-neutral-900">
        After you confirm your email, get your {partner.discountLabel} discount code on your dashboard.
      </p>
    </div>
  );
}
