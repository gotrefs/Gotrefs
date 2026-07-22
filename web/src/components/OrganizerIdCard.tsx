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
  logoUploaded?: boolean;
  logoUrl?: string | null;
  brandHexPrimary?: string | null;
  brandHexSecondary?: string | null;
  onUploadLogo?: (file: File) => void;
};

function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed)) return null;
  return trimmed;
}

export function OrganizerIdCard({
  contactName,
  organizationName,
  email,
  primarySport,
  additionalSports = [],
  typicalPay,
  bio,
  eventsCount = 0,
  logoUploaded,
  logoUrl,
  brandHexPrimary,
  brandHexSecondary,
  onUploadLogo,
}: OrganizerIdCardProps) {
  const logoInitials =
    organizationName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ORG";
  const sports = [primarySport, ...additionalSports].filter((sport): sport is string => Boolean(sport?.trim()));
  const primary = normalizeHex(brandHexPrimary) ?? "#0D1B2A";
  const secondary = normalizeHex(brandHexSecondary) ?? "#7F1D1D";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 p-5 text-white shadow-2xl">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, ${primary}f5, ${primary}eb 45%, ${secondary}e0)`,
        }}
      />
      <div className="relative">
        {logoUploaded && (
          <div className="flex justify-end">
            <span className="rounded-full border border-emerald-200 bg-emerald-300/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50">
              Logo on card
            </span>
          </div>
        )}

        <div className={`grid grid-cols-[7rem_1fr] gap-4 ${logoUploaded ? "mt-4" : ""}`}>
          <div className="relative">
            <label
              className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/25 bg-white/10 text-3xl font-black text-white ${
                onUploadLogo ? "hover:border-white/50" : "cursor-default"
              }`}
            >
              {logoUploaded && logoUrl ? (
                // Native img: signed storage URLs are ephemeral.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={`${organizationName ?? "Organization"} logo`}
                  className="h-full w-full object-contain bg-white/95 p-2"
                />
              ) : (
                logoInitials
              )}
              {onUploadLogo ? (
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadLogo(file);
                    e.target.value = "";
                  }}
                />
              ) : null}
            </label>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/80">
              {BRAND_NAME} organizer
            </p>
            <h3 className="mt-2 min-h-9 truncate text-3xl font-black tracking-tight">{organizationName}</h3>
            <p className="mt-1 min-h-5 text-sm font-bold text-cyan-100">{contactName}</p>
            <p className="mt-1 min-h-4 truncate text-xs text-white/55">{email}</p>
            {onUploadLogo && !logoUploaded ? (
              <p className="mt-2 text-[11px] font-semibold text-cyan-100/80">Tap to upload your organization logo</p>
            ) : null}
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
              Logo on card
            </span>
          )}
          {(normalizeHex(brandHexPrimary) || normalizeHex(brandHexSecondary)) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-white/90">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: primary }}
                aria-hidden
              />
              Brand colors
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
