"use client";

import { useEffect, useMemo, useState, type ReactNode, type Ref } from "react";
import QRCode from "qrcode";
import { BRAND_NAME } from "@/lib/brand";
import { publicRefIdCardUrl } from "@/lib/public-card-url";

export type EditableRefCardField =
  | "profile"
  | "photo"
  | "location"
  | "sports"
  | "certification"
  | "rate"
  | "availability"
  | "verification";

type RefereeIdCardProps = {
  fullName?: string;
  gotrefsId?: string;
  cardTitle?: string;
  primarySport?: string;
  additionalSports?: string[];
  certificationLevel?: string;
  additionalCertificationLevels?: string[];
  certifiedBy?: string;
  rate?: string;
  avatarUrl?: string;
  avatarLabel?: string;
  baseCity?: string;
  workRegions?: string[];
  travelRadius?: string;
  availabilitySummary?: string;
  govIdUploaded?: boolean;
  certUploaded?: boolean;
  backgroundStatus?: string | null;
  verificationStatus?: string | null;
  verificationSkipped?: boolean;
  emptyPlaceholders?: boolean;
  profileComplete?: boolean;
  validThrough?: string | null;
  /** Hide the QR block (used on the public scan page). */
  hideQr?: boolean;
  onEditField?: (field: EditableRefCardField) => void;
  onUploadPhoto?: (file: File) => void;
  className?: string;
  cardRef?: Ref<HTMLDivElement>;
};

/** Brand palette from globals.css */
const C = {
  navy: "#26213e",
  navyDeep: "#1a1730",
  navyMid: "#3d3851",
  navyHero: "#221e3f",
  gold: "#c9a227",
  goldLight: "#f0d78c",
  goldDark: "#4a3208",
  white: "#ffffff",
  ink: "#202442",
  accent: "#d81d24",
};

function splitList(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function validYearRange(validThrough?: string | null): string | null {
  if (!validThrough?.trim()) return null;
  const yearMatch = validThrough.match(/(20\d{2})/);
  if (!yearMatch) return validThrough.trim();
  const endYear = Number(yearMatch[1]);
  if (!Number.isFinite(endYear)) return validThrough.trim();
  return `${endYear - 1}-${endYear}`;
}

function RefIdQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: 240,
      color: { dark: "#111111", light: "#ffffff" },
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
    return (
      <div
        className="flex h-full w-full items-center justify-center text-[9px] font-bold uppercase tracking-wide"
        style={{ color: C.navyMid }}
      >
        QR
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR code for ${value}`} className="h-full w-full object-contain" />;
}

function InfoBox({
  title,
  onClick,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-[6px] text-left shadow-md ${className}`}
      style={{ background: C.white, border: `1.5px solid ${C.gold}` }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`px-2.5 py-1.5 text-left ${onClick ? "cursor-pointer transition hover:brightness-95" : "cursor-default"}`}
        style={{
          background: `linear-gradient(180deg, ${C.goldLight} 0%, ${C.gold} 100%)`,
        }}
      >
        <p
          className="text-[9px] font-black uppercase tracking-[0.08em]"
          style={{ color: C.goldDark }}
        >
          {title}
        </p>
      </button>
      <div className={`min-h-0 overflow-y-auto overscroll-contain px-2.5 py-2 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

const editableTap =
  "cursor-pointer text-left transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a227]";

export function RefereeIdCard({
  gotrefsId,
  primarySport,
  additionalSports = [],
  certificationLevel,
  additionalCertificationLevels = [],
  certifiedBy,
  avatarUrl,
  avatarLabel = "REF",
  baseCity,
  workRegions = [],
  validThrough,
  emptyPlaceholders,
  hideQr = false,
  onEditField,
  onUploadPhoto,
  className = "",
  cardRef,
}: RefereeIdCardProps) {
  const id = gotrefsId?.trim() || (emptyPlaceholders ? "" : "GR-2026-4587");
  const sports = [primarySport, ...additionalSports]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const acceptedBy = splitList(certifiedBy);
  const city =
    baseCity?.trim() ||
    workRegions.filter(Boolean).slice(0, 2).join(", ") ||
    (emptyPlaceholders ? "" : "Add city");
  const years = validYearRange(validThrough);
  const expireLabel = validThrough?.trim() || (emptyPlaceholders ? "" : "Pending approval");
  const typeLabel = certificationLevel?.trim() || `${BRAND_NAME} Accreditation`;

  const gamesList = useMemo(() => {
    if (sports.length > 0) return sports;
    return emptyPlaceholders ? [] : ["Add sports you officiate"];
  }, [sports, emptyPlaceholders]);

  const acceptedList = useMemo(() => {
    if (acceptedBy.length > 0) return acceptedBy;
    const levels = [certificationLevel, ...additionalCertificationLevels]
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item));
    if (levels.length > 0) return levels;
    return emptyPlaceholders ? [] : ["Add where you were certified"];
  }, [acceptedBy, certificationLevel, additionalCertificationLevels, emptyPlaceholders]);

  const [publicIdUrl, setPublicIdUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id || hideQr) {
      setPublicIdUrl(null);
      return;
    }
    // Only ever encode a real http(s) card URL — never the bare GotRefs ID text.
    const url = publicRefIdCardUrl(id);
    setPublicIdUrl(url.startsWith("http") ? url : null);
  }, [id, hideQr]);

  const qrPayload = publicIdUrl;

  return (
    <div
      ref={cardRef}
      data-ref-id-card
      className={`relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[18px] shadow-[0_20px_50px_rgba(38,33,62,0.35)] ${className}`}
      style={{
        background: C.navy,
        border: `3px solid ${C.gold}`,
        color: C.ink,
        fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Subtle field watermark on navy body */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 12% 40%, rgba(255,255,255,0.9) 0 1px, transparent 2px),
            radial-gradient(circle at 88% 55%, rgba(255,255,255,0.7) 0 1px, transparent 2px),
            repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,0.35) 22px 23px)
          `,
          backgroundSize: "48px 48px, 56px 56px, auto",
        }}
      />

      <div className="relative">
        {/* ── Header (site navy, mockup structure) ── */}
        <div
          className="relative flex items-center gap-2 px-3 py-2"
          style={{ background: C.navyDeep }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gotrefs-logo-blue-background.png"
            alt={BRAND_NAME}
            className="h-9 w-auto shrink-0 object-contain sm:h-10"
          />
          <div className="min-w-0 flex-1 text-center pr-9 sm:pr-10">
            <p
              className="truncate text-[8px] font-bold tracking-[0.12em] text-white/85 sm:text-[9px]"
            >
              {BRAND_NAME} Verified Official Network
            </p>
            <h2
              className="mt-0.5 text-[1.15rem] font-black uppercase leading-none tracking-[0.04em] text-white sm:text-[1.35rem]"
            >
              Official ID Card
            </h2>
          </div>
        </div>

        {/* ── White identity panel with curved bottom ── */}
        <div className="relative bg-white px-3.5 pb-5 pt-3.5 sm:px-4">
          <div className="grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[7.25rem_1fr] sm:gap-4">
            <div>
              <label
                className={`relative block aspect-square w-full overflow-hidden bg-neutral-100 ${editableTap}`}
                style={{ border: `3px solid ${C.gold}`, borderRadius: 4 }}
                aria-label={avatarUrl ? "Change profile photo" : "Add profile photo"}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Official profile photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-white"
                    style={{
                      background: `linear-gradient(160deg, ${C.navyMid}, ${C.navyDeep})`,
                    }}
                  >
                    <span className="text-xl font-black">{avatarLabel}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wide">Add photo</span>
                  </div>
                )}
                {onUploadPhoto ? (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadPhoto(file);
                      e.target.value = "";
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="absolute inset-0"
                    onClick={() => onEditField?.("photo")}
                    aria-label="Edit profile photo"
                  />
                )}
              </label>
              <p
                className="mt-1.5 text-center text-[10px] font-black uppercase tracking-wide"
                style={{ color: C.ink }}
              >
                {years ? `Valid ${years}` : "Valid pending"}
              </p>
            </div>

            <div className="min-w-0 space-y-2 pt-1 text-[12px] leading-snug sm:text-[13px]">
              <button
                type="button"
                onClick={() => onEditField?.("profile")}
                className={`block w-full ${editableTap}`}
              >
                <p style={{ color: C.ink }}>
                  <span className="font-bold">Referee ID: </span>
                  <span className="font-semibold tracking-wide">{id || "—"}</span>
                </p>
              </button>
              <p style={{ color: C.ink }}>
                <span className="font-bold">Expire Date: </span>
                <span className="font-semibold">{expireLabel || "—"}</span>
              </p>
              <button
                type="button"
                onClick={() => onEditField?.("certification")}
                className={`block w-full ${editableTap}`}
              >
                <p style={{ color: C.ink }}>
                  <span className="font-bold">Type: </span>
                  <span className="font-semibold normal-case">{typeLabel}</span>
                </p>
              </button>

              {/* Seal (matches mockup accent under details) */}
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black text-white shadow"
                  style={{
                    background: `conic-gradient(from 40deg, ${C.gold}, ${C.navyMid}, ${C.goldLight}, ${C.navy}, ${C.gold})`,
                    border: `2px solid ${C.gold}`,
                  }}
                  aria-hidden
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[8px]"
                    style={{ background: C.navyDeep }}
                  >
                    GR
                  </span>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.navyMid }}>
                  Verified official
                </p>
              </div>
            </div>
          </div>

          {/* Curve into navy body */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-px left-0 right-0 h-5"
            style={{
              background: C.navy,
              borderTopLeftRadius: "50% 100%",
              borderTopRightRadius: "50% 100%",
            }}
          />
        </div>

        {/* ── Brand crest + data boxes ── */}
        <div className="relative px-3 pb-3.5 pt-1 sm:px-3.5">
          <div className="mx-auto flex max-w-[300px] flex-col items-center text-center">
            {/* Crest: site logo in gold frame */}
            <div
              className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center overflow-hidden rounded-full p-1 shadow-lg sm:h-[5.5rem] sm:w-[5.5rem]"
              style={{
                background: C.navyHero,
                border: `3px solid ${C.gold}`,
                boxShadow: `0 0 0 3px ${C.navyDeep}, 0 10px 24px rgba(0,0,0,0.35)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gotrefs-logo-blue-background.png"
                alt={BRAND_NAME}
                className="h-full w-full object-contain"
              />
            </div>

            {/* GOT REF'S banner */}
            <div
              className="relative z-10 -mt-1 w-full max-w-[260px] px-3 py-1.5"
              style={{
                background: C.navyDeep,
                border: `2px solid ${C.gold}`,
                clipPath: "polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)",
              }}
            >
              <p
                className="text-[1.35rem] font-black uppercase leading-none tracking-tight text-white sm:text-[1.55rem]"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.35)" }}
              >
                GOT REF&apos;S
              </p>
            </div>

            {/* Qualified Officials ribbon */}
            <div
              className="relative z-0 -mt-0.5 px-4 py-1"
              style={{
                background: C.navyMid,
                border: `1.5px solid ${C.gold}`,
                clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white">
                Qualified Officials
              </p>
            </div>
          </div>

          {/* Games + Location */}
          <div className="mt-3.5 grid h-[7.5rem] grid-cols-2 gap-2">
            <InfoBox
              title="Games certified to ref"
              onClick={() => onEditField?.("sports")}
              className="h-full"
              bodyClassName="max-h-[5.25rem]"
            >
              <ul className="space-y-0.5 text-[10px] font-semibold leading-snug sm:text-[11px]" style={{ color: C.ink }}>
                {gamesList.map((sport) => (
                  <li key={sport}>• {sport}</li>
                ))}
              </ul>
            </InfoBox>

            <InfoBox
              title="Location"
              onClick={() => onEditField?.("location")}
              className="h-full"
              bodyClassName="max-h-[5.25rem]"
            >
              <p className="text-[10px] font-semibold leading-snug sm:text-[11px]" style={{ color: C.ink }}>
                <span className="font-bold">City: </span>
                {city || "—"}
              </p>
            </InfoBox>
          </div>

          {/* QR + Accepted by */}
          <div className={`mt-2 grid h-[7.75rem] gap-2 ${hideQr ? "grid-cols-1" : "grid-cols-[5.75rem_1fr] sm:grid-cols-[6.5rem_1fr]"}`}>
            {!hideQr ? (
              <div
                data-hide-from-id-scan="true"
                className="overflow-hidden rounded-[6px] p-1.5 shadow-md"
                style={{ background: C.white, border: `1.5px solid ${C.gold}` }}
              >
                <div className="aspect-square w-full">
                  {qrPayload ? (
                    <RefIdQr value={qrPayload} />
                  ) : (
                    <div
                      className="flex h-full items-center justify-center text-[9px] font-bold"
                      style={{ color: C.navyMid }}
                    >
                      …
                    </div>
                  )}
                </div>
                <p
                  className="mt-1 text-center text-[7px] font-bold uppercase tracking-wide"
                  style={{ color: C.navyMid }}
                >
                  Scan for official ID
                </p>
              </div>
            ) : null}

            <InfoBox
              title="Accepted by"
              onClick={() => onEditField?.("certification")}
              className="h-full"
              bodyClassName="max-h-[5.5rem]"
            >
              <ul
                className="space-y-0.5 text-[10px] font-semibold leading-snug sm:text-[11px]"
                style={{ color: C.ink }}
              >
                {acceptedList.map((org) => (
                  <li key={org}>• {org}</li>
                ))}
              </ul>
            </InfoBox>
          </div>
        </div>
      </div>
    </div>
  );
}
