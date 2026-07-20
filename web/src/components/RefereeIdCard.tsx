import Image from "next/image";
import { BrandName } from "@/components/BrandName";
import { BRAND_NAME } from "@/lib/brand";

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
  onEditField?: (field: EditableRefCardField) => void;
  /** When set, tapping the photo opens a file picker and uploads immediately. */
  onUploadPhoto?: (file: File) => void;
  className?: string;
};

function statusLabel(value?: string | null) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ");
}

function CardBadge({
  active,
  skipped,
  label,
  pendingLabel,
}: {
  active: boolean;
  skipped?: boolean;
  label: string;
  pendingLabel?: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
        active
          ? "border-emerald-200 bg-emerald-300/20 text-emerald-50 shadow-[0_0_18px_rgba(52,211,153,0.45)]"
          : skipped
            ? "border-red-200 bg-red-500/25 text-red-50 shadow-[0_0_18px_rgba(239,68,68,0.45)]"
            : "border-yellow-200/40 bg-yellow-300/10 text-yellow-50/75"
      }`}
    >
      {active ? label : skipped ? "✕ Unverified" : pendingLabel || "Processing"}
    </span>
  );
}

const SPORT_ICON_MAP: Record<string, string> = {
  Basketball: "🏀",
  Football: "🏈",
  Soccer: "⚽",
  Baseball: "⚾",
  Softball: "🥎",
  Volleyball: "🏐",
  Hockey: "🏒",
  Lacrosse: "🥍",
  Wrestling: "🤼",
  Tennis: "🎾",
  Golf: "⛳",
  Swimming: "🏊",
  "Track & Field": "🏃",
  "Cross Country": "🏃",
  "Flag Football": "🚩",
  "7v7 Football": "🏈",
  Futsal: "⚽",
};

function sportIcon(sport: string) {
  return SPORT_ICON_MAP[sport] || "🏅";
}

const editableClass =
  "cursor-pointer text-left transition hover:border-cyan-200/60 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-200/60";

export function RefereeIdCard({
  fullName,
  gotrefsId,
  cardTitle,
  primarySport,
  additionalSports = [],
  certificationLevel,
  certifiedBy,
  rate,
  avatarUrl,
  avatarLabel = "REF",
  baseCity,
  workRegions = [],
  travelRadius,
  availabilitySummary,
  govIdUploaded,
  certUploaded,
  backgroundStatus,
  verificationStatus,
  verificationSkipped,
  emptyPlaceholders,
  profileComplete,
  onEditField,
  onUploadPhoto,
  className = "",
}: RefereeIdCardProps) {
  const name = fullName?.trim() || (emptyPlaceholders ? "" : "Marcus Johnson");
  const sport = primarySport?.trim()
    ? `${primarySport.trim()} Official`
    : emptyPlaceholders
      ? ""
      : "Football Official";
  const cert = certificationLevel?.trim() || (emptyPlaceholders ? "" : "Certification level");
  const certOrg = certifiedBy?.trim() || (emptyPlaceholders ? "" : "Certified By");
  const id = gotrefsId?.trim() || (emptyPlaceholders ? "" : "GR-2026-4587");
  const city = baseCity?.trim() || (emptyPlaceholders ? "" : "Base city");
  const regions = workRegions.filter(Boolean);
  const regionText = regions.length
    ? regions.slice(0, 3).join(", ")
    : emptyPlaceholders
      ? ""
      : "Regions willing to work";
  const radius = travelRadius?.trim();
  const willingToTravel = Boolean(radius && Number(radius) > 0);
  const availability = availabilitySummary?.trim() || (emptyPlaceholders ? "" : "Add availability");
  const screeningClear = backgroundStatus === "clear";
  const submitted = ["submitted", "under_review", "approved"].includes(verificationStatus ?? "");
  const showRedUnverified = Boolean(verificationSkipped && !screeningClear && !submitted);
  const sports = [primarySport, ...additionalSports].filter((item): item is string => Boolean(item?.trim()));
  const hasLocation = Boolean(regionText || city || radius);
  const hasCertification = Boolean(cert || certOrg);
  const hasVerificationState = Boolean(
    profileComplete || primarySport || govIdUploaded || certUploaded || screeningClear || submitted || showRedUnverified
  );
  const hasStatus = Boolean(screeningClear || showRedUnverified || verificationStatus);
  const completionItems = [
    Boolean(fullName?.trim()),
    Boolean(primarySport?.trim()),
    Boolean(certificationLevel?.trim()),
    Boolean(baseCity?.trim() || workRegions.length || travelRadius?.trim()),
    Boolean(govIdUploaded),
    Boolean(certUploaded),
    screeningClear || submitted,
  ];
  const showProgress = !emptyPlaceholders || completionItems.some(Boolean);
  const percent = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  return (
    <div
      className={`relative overflow-hidden rounded-[1.5rem] border border-white/25 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-950/30 backdrop-blur sm:rounded-[2rem] sm:p-5 ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(13,27,59,0.96),rgba(8,18,38,0.92)_45%,rgba(127,29,29,0.88)),radial-gradient(circle_at_top_right,rgba(239,68,68,0.45),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.45),transparent_36%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-white/15 blur-3xl" />
      <div className="absolute -right-16 top-16 h-44 w-44 rounded-full border border-white/10" />
      <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full border border-white/10" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="rounded-xl bg-white/95 px-2.5 py-2 shadow-lg sm:px-3">
            <Image src="/gotrefs-logo.png" alt={BRAND_NAME} width={150} height={56} className="h-8 w-auto sm:h-10" />
          </div>
          <div className="text-right">
            {id && (
              <>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/45">
                  <BrandName /> ID
                </p>
                <p className="mt-1 rounded-full border border-cyan-200/50 bg-cyan-300/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-50 shadow-[0_0_20px_rgba(103,232,249,0.35)]">
                  {id}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-[5.75rem_1fr] gap-3 sm:mt-6 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
          <div className="relative">
            <label
              className={`relative block aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-[1.6rem] border border-white/25 bg-white/10 shadow-2xl shadow-black/25 ${editableClass}`}
              aria-label={avatarUrl ? "Change profile photo" : "Add profile photo"}
            >
              {avatarUrl ? (
                // Uploaded photos use signed/object URLs, so use a native image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={`${name} avatar`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.32),transparent_20%),linear-gradient(160deg,rgba(59,130,246,0.7),rgba(239,68,68,0.72))] px-2 text-center">
                  <span className="text-2xl font-black sm:text-3xl">{avatarLabel}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-white/90">Add photo</span>
                </div>
              )}
              {onUploadPhoto ? (
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="sr-only"
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
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-green-400 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-green-950 shadow-lg">
              Active
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/80">
              {cardTitle || `${BRAND_NAME} verified official`}
            </p>
            <button type="button" onClick={() => onEditField?.("profile")} className="block max-w-full text-left">
              <h3 className="mt-2 min-h-8 truncate text-2xl font-black tracking-tight hover:text-cyan-100 sm:min-h-9 sm:text-3xl">
                {name}
              </h3>
            </button>
            <button type="button" onClick={() => onEditField?.("sports")} className="mt-1 text-left">
              <p className="min-h-5 text-sm font-bold text-cyan-100 hover:text-white sm:min-h-6 sm:text-base">
                {sport}
              </p>
            </button>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:mt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onEditField?.("certification")}
                className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
              >
                {cert && <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Level</p>}
                <p className="mt-1 min-h-4 truncate font-bold">
                  {cert}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onEditField?.("rate")}
                className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
              >
                {rate && <p className="text-[9px] uppercase tracking-[0.18em] text-white/45">Rate</p>}
                <p className="mt-1 min-h-4 font-bold">
                  {rate ? `$${rate}/game` : emptyPlaceholders ? "" : "Set later"}
                </p>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_0.9fr]">
          <button
            type="button"
            onClick={() => onEditField?.("location")}
            className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
          >
            <div className="flex items-center justify-between gap-2">
              {hasLocation && (
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Regions willing to work</p>
              )}
              {radius && (
                <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase text-white/70">
                  Travel {willingToTravel ? "Yes" : "No"}
                </span>
              )}
            </div>
            <p className="mt-2 min-h-5 text-sm font-bold">
              {regionText}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {city}
              {radius ? ` · ${radius} mi radius` : ""}
            </p>
            <div className="mt-3 flex h-14 items-end gap-2 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
              {hasLocation &&
                [0, 1, 2].map((pin) => (
                  <span
                    key={pin}
                    className={`block rounded-full bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.55)] ${
                      pin === 0 ? "h-6 w-2" : pin === 1 ? "h-9 w-2" : "h-4 w-2"
                    } ${regions.length > pin || baseCity ? "opacity-100" : "opacity-25"}`}
                  />
                ))}
              {hasLocation && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                  Map pins
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onEditField?.("sports")}
            className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
          >
            {sports.length > 0 && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Eligible sports</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {sports.slice(0, 6).map((item) => (
                <span
                  key={item}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/60 bg-cyan-300/15 text-base shadow-[0_0_16px_rgba(103,232,249,0.32)]"
                  title={item}
                >
                  {sportIcon(item)}
                </span>
              ))}
            </div>
            {hasCertification && (
              <>
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Certified by</p>
                <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[var(--red)]">
                    ✓
                  </span>
                  <span className="truncate">{certOrg}</span>
                </div>
              </>
            )}
          </button>
        </div>

        {hasVerificationState && (
          <button
            type="button"
            onClick={() => onEditField?.("verification")}
            className="mt-5 flex flex-wrap gap-2 text-left"
          >
            <CardBadge active={Boolean(profileComplete || primarySport)} label="Profile Ready" pendingLabel={emptyPlaceholders ? "" : "Profile Pending"} />
            <CardBadge active={Boolean(govIdUploaded)} skipped={showRedUnverified} label="Identity Verified" pendingLabel={emptyPlaceholders ? "" : "Identity Processing"} />
            <CardBadge active={Boolean(certUploaded)} skipped={showRedUnverified} label="Certified Official" pendingLabel={emptyPlaceholders ? "" : "Cert Processing"} />
            <CardBadge active={screeningClear || submitted} skipped={showRedUnverified} label="Background Checked" pendingLabel={emptyPlaceholders ? "" : "Background Processing"} />
          </button>
        )}

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onEditField?.("availability")}
            className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
          >
            {availability && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Availability</p>}
            <p className="mt-1 min-h-5 font-bold">
              {availability}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onEditField?.("verification")}
            className={`rounded-2xl border border-white/10 bg-white/10 p-3 ${editableClass}`}
          >
            {hasStatus && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Status</p>}
            <p className="mt-1 font-bold capitalize">
              {screeningClear ? (
                "Verified"
              ) : showRedUnverified ? (
                "Unverified"
              ) : emptyPlaceholders && !verificationStatus ? (
                <span className="block h-4 w-20 rounded-full bg-white/10" />
              ) : (
                statusLabel(verificationStatus)
              )}
            </p>
          </button>
        </div>

        {showProgress && <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-white/70">
            <span>Card build</span>
            <span>{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-300 to-red-300 shadow-[0_0_18px_rgba(103,232,249,0.65)] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>}

        <div className="mt-5 min-h-9 text-xs text-white/55">
          {additionalSports.length > 0
            ? `Also covers: ${additionalSports.slice(0, 4).join(", ")}`
            : emptyPlaceholders
              ? ""
              : "Add more sports and badges as your profile grows."}
        </div>
      </div>
    </div>
  );
}
