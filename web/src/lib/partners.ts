/** GotRefs partner placements — branding and perk CTAs (no API integration). */

export const NATIONAL_SPORTSID = {
  id: "national-sportsid",
  name: "National SportsID",
  shortName: "SportsID",
  blurb: "Our verification partner for checking and verifying officials.",
  logoSrc: "/partners/national-sportsid.png",
  href: "https://www.nationalsportsid.com",
} as const;

export const US_OFFICIALS_SUPPLIES = {
  id: "us-officials-supplies",
  name: "U.S. Officials Supplies",
  shortName: "U.S. Officials",
  blurb: "Member pricing on official gear — 10% off for GotRefs officials.",
  discountLabel: "10% off",
  logoSrc: "/partners/us-officials-supplies.png",
  /** Replace with the live store / affiliate URL when you have it. */
  href: "https://usofficialssupplies.com/",
  /** Coupon code for GotRefs officials at checkout. */
  couponCode: "GotRefs10",
} as const;
