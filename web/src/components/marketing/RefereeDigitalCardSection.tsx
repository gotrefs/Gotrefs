"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { VerificationPartnerBadge } from "@/components/partners/VerificationPartnerBadge";

/** Same palette as the signup `RefereeIdCard`. */
const C = {
  navy: "#26213e",
  navyDeep: "#1a1730",
  navyMid: "#3d3851",
  gold: "#c9a227",
  goldLight: "#f0d78c",
  goldDark: "#4a3208",
  white: "#ffffff",
  ink: "#202442",
} as const;

const DEMO = {
  fullName: "Marcus Johnson",
  title: "Football Official",
  gotrefsId: "GR-2026-4587",
  photo: "/gotrefs-demo-ref-marcus.jpg",
  thumb: "/gotrefs-demo-ref-marcus-thumb.jpg",
  city: "Atlanta, Georgia, USA",
  rating: "4.9",
  reviewsCount: 127,
  certifiedBy: "NFHS",
  sports: ["Football", "Basketball", "Soccer", "Baseball", "Lacrosse", "Volleyball"] as const,
  regions: ["Atlanta", "North Georgia", "Augusta", "Macon", "Columbus"] as const,
  travelMiles: 100,
  reviews: [
    { name: "Jordan Lee", text: "On time, clear calls, great with coaches.", stars: 5 },
    { name: "Sam Ortiz", text: "Professional and easy to work with.", stars: 5 },
    { name: "Casey Ng", text: "Game-ready official. Would book again.", stars: 5 },
  ] as const,
} as const;

function CheckBadge({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className="relative flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
        style={{ background: C.white, border: `2px solid ${C.gold}` }}
      >
        <span className="text-[11px] font-black" style={{ color: C.navyDeep }}>
          ✓
        </span>
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black text-white"
          style={{ background: C.gold }}
        >
          ✓
        </span>
      </div>
      <p
        className="max-w-[5.5rem] text-[8px] font-bold uppercase leading-tight tracking-wide sm:max-w-[6.25rem] sm:text-[9px]"
        style={{ color: C.navyDeep }}
      >
        {label}
      </p>
    </div>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-[10px] leading-none" style={{ color: C.gold }}>
          ★
        </span>
      ))}
    </span>
  );
}

function DemoQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: 160,
      color: { dark: C.navyDeep, light: C.white },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) {
    return <div className="flex h-full w-full items-center justify-center text-[9px] font-bold" style={{ color: C.navyMid }}>QR</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="GotRefs QR code" className="h-full w-full object-contain" />;
}

function MarketingSignupQr() {
  const [signupUrl, setSignupUrl] = useState("https://gotrefs.org/auth/signup");
  useEffect(() => {
    setSignupUrl(`${window.location.origin}/auth/signup`);
  }, []);
  return <DemoQr value={signupUrl} />;
}

function CardShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(38,33,62,0.28)] ${className}`}
      style={{ background: C.navy, border: `3px solid ${C.gold}`, color: C.ink }}
    >
      {children}
    </div>
  );
}

function CardFooter({ right }: { right?: string }) {
  return (
    <div
      className="mt-auto flex items-center justify-between gap-2 px-3 py-2"
      style={{ background: C.navyDeep, borderTop: `1.5px solid ${C.gold}` }}
    >
      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-white/90 sm:text-[8px]">
        Trusted. Verified. Game Ready.
      </p>
      <p className="shrink-0 text-[7px] font-semibold uppercase tracking-wide text-white/70 sm:text-[8px]">
        {right ?? "Powered by GotRefs"}
      </p>
    </div>
  );
}

/** Marketing front + back digital ref card — same layout as the original asset, signup navy/gold palette. */
function MarketingRefIdPair() {
  return (
    <div className="mx-auto grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:items-stretch sm:gap-2.5">
      {/* Front — big photo */}
      <CardShell className="h-full">
        <div className="flex items-start gap-2 px-2.5 pb-1.5 pt-2 sm:gap-2.5 sm:px-3 sm:pt-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gotrefs-logo-blue-background.png"
            alt="GotRefs"
            className="h-14 w-auto shrink-0 object-contain sm:h-[4.25rem]"
          />
          <div className="min-w-0 flex-1 pt-0.5 text-left">
            <p className="truncate text-[0.95rem] font-black uppercase leading-none tracking-wide text-white sm:text-[1.05rem]">
              {DEMO.fullName}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/90 sm:text-[10px]">
              {DEMO.title}
            </p>
            <div className="mt-1 h-0.5 w-12" style={{ background: C.gold }} />
            <p className="mt-1 text-[9px] font-semibold text-white/85 sm:text-[10px]">
              GotRefs ID: {DEMO.gotrefsId}
            </p>
          </div>
        </div>

        <div className="mx-2.5 flex min-h-0 flex-1 flex-col sm:mx-3">
          <div className="relative overflow-hidden" style={{ border: `2px solid ${C.gold}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEMO.photo}
              alt={`${DEMO.fullName} official photo`}
              className="aspect-square w-full object-cover object-center"
            />
            <div
              className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2 py-1.5"
              style={{ background: C.white, borderTop: `2px solid ${C.gold}` }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                style={{ background: C.navyDeep, border: `1.5px solid ${C.gold}` }}
                aria-hidden
              >
                ✓
              </span>
              <p className="text-sm font-black uppercase tracking-wide sm:text-base" style={{ color: C.navyDeep }}>
                Verified
              </p>
            </div>
          </div>

          <div
            className="flex flex-1 items-center justify-around gap-1 px-1 py-2 sm:py-2.5"
            style={{ background: C.white, borderLeft: `2px solid ${C.gold}`, borderRight: `2px solid ${C.gold}`, borderBottom: `2px solid ${C.gold}` }}
          >
            <CheckBadge label="Background Checked" />
            <CheckBadge label="Identity Verified" />
            <CheckBadge label="Certified Official" />
          </div>
        </div>

        <CardFooter />
      </CardShell>

      {/* Back — profile details */}
      <CardShell className="h-full">
        <div
          className="flex items-center justify-between gap-2 px-2.5 py-1.5"
          style={{ background: C.navyDeep, borderBottom: `2px solid ${C.gold}` }}
        >
          <p className="text-[7px] font-bold uppercase tracking-[0.14em] text-white/90 sm:text-[8px]">
            Trusted. Verified. Game Ready.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gotrefs-logo-blue-background.png" alt="" className="h-6 w-auto object-contain" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 bg-white px-2.5 py-2 text-left sm:px-3 sm:py-2">
          <p className="shrink-0 text-[8px] leading-snug sm:text-[9px]" style={{ color: C.ink }}>
            GotRefs connects verified officials with organizations that need them. Professional. Reliable. Ready to
            work.
          </p>

          <div className="grid shrink-0 grid-cols-[auto_1fr_auto] items-stretch gap-1.5">
            <div
              className="flex w-[4.5rem] overflow-hidden rounded-md sm:w-[5rem]"
              style={{ border: `1.5px solid ${C.gold}`, background: C.white }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEMO.thumb} alt="" className="h-full w-full object-cover object-center" />
            </div>

            <div className="flex min-w-0 flex-col justify-center">
              <p className="truncate text-xs font-black" style={{ color: C.navyDeep }}>
                {DEMO.fullName}
              </p>
              <p className="text-[8px]" style={{ color: C.navyMid }}>
                {DEMO.city}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-0.5 text-[9px] font-bold" style={{ color: C.ink }}>
                {DEMO.rating} <Stars count={5} />
                <span className="font-semibold" style={{ color: C.navyMid }}>
                  ({DEMO.reviewsCount} Reviews)
                </span>
              </p>
              <p className="mt-0.5 text-[8px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                Certified by {DEMO.certifiedBy}
              </p>
            </div>

            <div
              className="flex w-[4.5rem] flex-col items-center rounded-md p-1 sm:w-[5rem]"
              style={{ border: `1.5px solid ${C.gold}`, background: C.white }}
            >
              <p className="mb-0.5 text-[6px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                GotRefs QR
              </p>
              <div className="aspect-square w-full">
                <MarketingSignupQr />
              </div>
              <p className="mt-0.5 text-center text-[5px] font-semibold leading-tight" style={{ color: C.navyMid }}>
                Scan to sign up
              </p>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-3">
            <div
              className="flex h-full flex-col rounded-md p-1.5"
              style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}
            >
              <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                Eligible Sports
              </p>
              <ul className="mt-1 grid flex-1 grid-cols-2 content-start gap-x-0.5 gap-y-1">
                {DEMO.sports.map((sport) => (
                  <li
                    key={sport}
                    className="truncate rounded-full px-1 py-0.5 text-center text-[6px] font-bold uppercase"
                    style={{ background: C.navy, color: C.goldLight }}
                  >
                    {sport}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="flex h-full flex-col rounded-md p-1.5"
              style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}
            >
              <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                Regions Willing to Work
              </p>
              <ul className="mt-1 flex-1 space-y-0.5 text-[8px] font-semibold" style={{ color: C.ink }}>
                {DEMO.regions.map((region) => (
                  <li key={region}>• {region}</li>
                ))}
              </ul>
            </div>

            <div
              className="col-span-2 flex h-full flex-col justify-center rounded-md p-1.5 sm:col-span-1"
              style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}
            >
              <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                Willing to Travel
              </p>
              <p className="mt-1 text-xs font-black uppercase" style={{ color: C.navyDeep }}>
                Yes
              </p>
              <p className="text-[8px] font-semibold" style={{ color: C.ink }}>
                Up to {DEMO.travelMiles} miles
              </p>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div className="rounded-md p-1.5" style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}>
              <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                Recent Reviews
              </p>
              <ul className="mt-1 space-y-1">
                {DEMO.reviews.map((review) => (
                  <li key={review.name} className="text-[8px] leading-snug" style={{ color: C.ink }}>
                    <span className="font-bold">{review.name}</span> <Stars count={review.stars} />
                    <span className="block font-medium opacity-90">{review.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="rounded-md p-1.5" style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}>
                <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                  Availability
                </p>
                <p className="mt-1 text-xs font-black" style={{ color: C.navyDeep }}>
                  Available
                </p>
                <p className="text-[8px] font-semibold" style={{ color: C.navyMid }}>
                  View full schedule in the app
                </p>
              </div>
              <div className="rounded-md p-1.5" style={{ border: `1.5px solid ${C.gold}`, background: "#faf8f1" }}>
                <p className="text-[7px] font-black uppercase tracking-wide" style={{ color: C.goldDark }}>
                  Verified Status
                </p>
                <ul className="mt-1 space-y-0.5 text-[8px] font-bold" style={{ color: C.ink }}>
                  <li>
                    <span style={{ color: C.gold }}>✓</span> Background Checked
                  </li>
                  <li>
                    <span style={{ color: C.gold }}>✓</span> Identity Verified
                  </li>
                  <li>
                    <span style={{ color: C.gold }}>✓</span> Certified Official
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <CardFooter right={DEMO.gotrefsId} />
      </CardShell>
    </div>
  );
}

/** Full-screen digital referee ID card showcase. */
export function RefereeDigitalCardSection() {
  return (
    <section
      data-snap-section
      className="viewport-screen flex flex-col overflow-hidden border-t border-[var(--border)] bg-white px-3 py-2 sm:px-4 sm:py-3"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col items-center justify-between gap-1 text-center sm:justify-center sm:gap-2">
        <div className="shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--red)] sm:text-xs sm:tracking-[0.22em]">
            Verified officials
          </p>
          <h2 className="mt-1 max-w-4xl text-xl font-black leading-tight tracking-tight text-[#1b2132] sm:text-2xl md:text-[1.75rem]">
            Your digital ref card when you&apos;re verified
          </h2>
          <p className="mx-auto mt-1 hidden max-w-xl text-[13px] leading-snug text-[var(--muted)] sm:block">
            Organizers see at a glance that you&apos;re identity-verified, certified, and ready to work your games.
          </p>
        </div>

        <div className="flex min-h-0 w-full max-w-[520px] flex-1 items-center justify-center overflow-hidden md:max-w-[580px]">
          <div
            className="w-full max-h-full"
            style={{
              // Shrink layout + paint so the pair fits inside the remaining viewport band
              zoom: 0.82,
            }}
          >
            <MarketingRefIdPair />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5 sm:gap-2">
          <VerificationPartnerBadge />
          <Link href="/auth/signup?role=ref" className="btn-demo-hero inline-flex w-full sm:w-auto">
            Get verified as a ref
          </Link>
        </div>
      </div>
    </section>
  );
}
