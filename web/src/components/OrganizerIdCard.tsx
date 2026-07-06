import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

type OrganizerIdCardProps = {
  contactName?: string;
  organizationName?: string;
  email?: string;
  primarySport?: string;
  additionalSports?: string[];
  typicalPay?: string;
  bio?: string;
  eventsCount?: number;
  idUploaded?: boolean;
  logoUploaded?: boolean;
};

export function OrganizerIdCard({
  contactName,
  organizationName,
  email,
  primarySport,
  additionalSports = [],
  typicalPay,
  bio,
  eventsCount = 0,
  idUploaded,
  logoUploaded,
}: OrganizerIdCardProps) {
  const initials =
    organizationName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ORG";
  const sports = [primarySport, ...additionalSports].filter((sport): sport is string => Boolean(sport?.trim()));

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 p-5 text-white shadow-2xl">
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(13,27,59,0.96),rgba(8,18,38,0.92)_45%,rgba(127,29,29,0.88))]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-xl bg-white/95 px-3 py-2 shadow-lg">
            <Image src="/gotrefs-logo.png" alt={BRAND_NAME} width={150} height={56} className="h-8 w-auto" />
          </div>
          {idUploaded && (
            <span className="rounded-full border border-emerald-200 bg-emerald-300/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50">
              ID on file
            </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-[7rem_1fr] gap-4">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/25 bg-white/10 text-3xl font-black">
            {logoUploaded ? "LOGO" : initials}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/80">
              {BRAND_NAME} organizer
            </p>
            <h3 className="mt-2 min-h-9 truncate text-3xl font-black tracking-tight">{organizationName}</h3>
            <p className="mt-1 min-h-5 text-sm font-bold text-cyan-100">{contactName}</p>
            <p className="mt-1 min-h-4 truncate text-xs text-white/55">{email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            {primarySport && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Primary sport</p>}
            <p className="mt-1 min-h-5 font-bold">{primarySport}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            {typicalPay && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Typical pay</p>}
            <p className="mt-1 min-h-5 font-bold">{typicalPay ? `$${typicalPay}/official` : ""}</p>
          </div>
        </div>

        {sports.length > 1 && (
          <p className="mt-4 text-xs text-white/65">Also hosts: {sports.slice(1, 5).join(", ")}</p>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-3">
          {bio && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">About the organization</p>}
          <p className="mt-1 min-h-10 text-sm text-white/80">{bio}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {eventsCount > 0 && (
            <span className="rounded-full border border-cyan-200/50 bg-cyan-300/15 px-3 py-1 text-[10px] font-bold uppercase text-cyan-50">
              {eventsCount} upcoming event{eventsCount === 1 ? "" : "s"}
            </span>
          )}
          {logoUploaded && (
            <span className="rounded-full border border-emerald-200 bg-emerald-300/20 px-3 py-1 text-[10px] font-bold uppercase text-emerald-50">
              Logo uploaded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
