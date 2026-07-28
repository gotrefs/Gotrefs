import { US_OFFICIALS_SUPPLIES } from "@/lib/partners";

type RefGearCouponNoticeProps = {
  className?: string;
};

/** Plain checkout-code callout shown after refs finish signup / on the ref dashboard. */
export function RefGearCouponNotice({ className = "" }: RefGearCouponNoticeProps) {
  const partner = US_OFFICIALS_SUPPLIES;
  const code = partner.couponCode;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-[var(--navy)] ${className}`}
    >
      <p className="font-semibold">
        Use code{" "}
        <span className="font-black tracking-wide">{code}</span> at checkout for {partner.discountLabel} at{" "}
        {partner.name}.
      </p>
    </div>
  );
}
