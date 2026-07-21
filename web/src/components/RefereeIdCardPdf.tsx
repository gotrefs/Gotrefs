import type { CSSProperties } from "react";
import { BRAND_NAME } from "@/lib/brand";

/** Props for the print/PDF clone — same fields as the live dashboard card. */
export type RefereeIdCardPdfProps = {
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
  profileComplete?: boolean;
  validThrough?: string | null;
  /** Absolute or data URL for the logo (capture-safe). */
  logoUrl?: string;
};

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

function statusLabel(value?: string | null) {
  if (!value) return "Pending";
  return value.replace(/_/g, " ");
}

function PdfBadge({
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
  const style: CSSProperties = active
    ? {
        border: "1px solid #a7f3d0",
        background: "rgba(110, 231, 183, 0.2)",
        color: "#ecfdf5",
        boxShadow: "0 0 18px rgba(52, 211, 153, 0.45)",
      }
    : skipped
      ? {
          border: "1px solid #fecaca",
          background: "rgba(239, 68, 68, 0.25)",
          color: "#fef2f2",
          boxShadow: "0 0 18px rgba(239, 68, 68, 0.45)",
        }
      : {
          border: "1px solid rgba(254, 240, 138, 0.4)",
          background: "rgba(253, 224, 71, 0.1)",
          color: "rgba(254, 252, 232, 0.75)",
        };

  return (
    <span
      style={{
        ...style,
        borderRadius: 9999,
        padding: "4px 12px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        display: "inline-block",
      }}
    >
      {active ? label : skipped ? "✕ Unverified" : pendingLabel || "Processing"}
    </span>
  );
}

const panel: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  background: "rgba(255, 255, 255, 0.1)",
  padding: 12,
  textAlign: "left",
};

const mutedLabel: CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.45)",
};

/**
 * Capture-safe visual twin of RefereeIdCard.
 * Uses only inline hex/rgba styles (no Tailwind color utilities).
 */
export function RefereeIdCardPdf({
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
  profileComplete,
  validThrough,
  logoUrl = "/gotrefs-logo.png",
}: RefereeIdCardPdfProps) {
  const name = fullName?.trim() || "Marcus Johnson";
  const sport = primarySport?.trim() ? `${primarySport.trim()} Official` : "Football Official";
  const cert = certificationLevel?.trim() || "Certification level";
  const certOrg = certifiedBy?.trim() || "Certified By";
  const id = gotrefsId?.trim() || "GR-2026-4587";
  const city = baseCity?.trim() || "Base city";
  const regions = workRegions.filter(Boolean);
  const regionText = regions.length ? regions.slice(0, 3).join(", ") : "Regions willing to work";
  const radius = travelRadius?.trim();
  const willingToTravel = Boolean(radius && Number(radius) > 0);
  const availability = availabilitySummary?.trim() || "Add availability";
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
  const percent = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  return (
    <div
      data-ref-id-card-pdf
      style={{
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        width: 400,
        borderRadius: 32,
        border: "1px solid rgba(255, 255, 255, 0.25)",
        background: "#020617",
        padding: 20,
        color: "#ffffff",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        boxShadow: "0 25px 50px -12px rgba(2, 6, 23, 0.3)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(145deg, rgba(13,27,59,0.96), rgba(8,18,38,0.92) 45%, rgba(127,29,29,0.88)), radial-gradient(circle at top right, rgba(239,68,68,0.45), transparent 35%), radial-gradient(circle at bottom left, rgba(59,130,246,0.45), transparent 36%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 96,
          backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -64,
          top: 64,
          height: 176,
          width: 176,
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -64,
          height: 224,
          width: 224,
          borderRadius: "50%",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      />

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div
            style={{
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.95)",
              padding: "8px 12px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={BRAND_NAME} style={{ height: 40, width: "auto", display: "block" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            {id && (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.45)",
                  }}
                >
                  {BRAND_NAME} ID
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    display: "inline-block",
                    borderRadius: 9999,
                    border: "1px solid rgba(165, 243, 252, 0.5)",
                    background: "rgba(103, 232, 249, 0.15)",
                    padding: "4px 12px",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#ecfeff",
                    boxShadow: "0 0 20px rgba(103, 232, 249, 0.35)",
                  }}
                >
                  {id}
                </p>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "7.5rem 1fr",
            gap: 16,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "relative",
                display: "block",
                aspectRatio: "4 / 5",
                width: "100%",
                overflow: "hidden",
                borderRadius: "1.6rem",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                background: "rgba(255, 255, 255, 0.1)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`${name} avatar`}
                  style={{ height: "100%", width: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    height: "100%",
                    width: "100%",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    backgroundImage:
                      "radial-gradient(circle at 50% 25%, rgba(255,255,255,0.32), transparent 20%), linear-gradient(160deg, rgba(59,130,246,0.7), rgba(239,68,68,0.72))",
                    padding: 8,
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{avatarLabel}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    Add photo
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -8,
                left: "50%",
                transform: "translateX(-50%)",
                maxWidth: "95%",
                borderRadius: 9999,
                background: "#4ade80",
                padding: "4px 12px",
                textAlign: "center",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#052e16",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                whiteSpace: "nowrap",
              }}
            >
              {validThrough ? `Valid thru ${validThrough}` : "Active"}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(207, 250, 254, 0.8)",
              }}
            >
              {cardTitle || `${BRAND_NAME} verified official`}
            </p>
            <h3
              style={{
                margin: "8px 0 0",
                minHeight: 36,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "-0.025em",
                color: "#ffffff",
              }}
            >
              {name}
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                minHeight: 24,
                fontSize: 16,
                fontWeight: 700,
                color: "#cffafe",
              }}
            >
              {sport}
            </p>
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontSize: 12,
              }}
            >
              <div style={panel}>
                {cert && <p style={mutedLabel}>Level</p>}
                <p
                  style={{
                    margin: cert ? "4px 0 0" : 0,
                    minHeight: 16,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  {cert}
                </p>
              </div>
              <div style={panel}>
                {rate && <p style={mutedLabel}>Rate</p>}
                <p style={{ margin: rate ? "4px 0 0" : 0, minHeight: 16, fontWeight: 700, color: "#ffffff" }}>
                  {rate ? `$${rate}/game` : "Set later"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "1fr 0.9fr",
            gap: 12,
          }}
        >
          <div style={panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              {hasLocation && <p style={mutedLabel}>Regions willing to work</p>}
              {radius && (
                <span
                  style={{
                    borderRadius: 9999,
                    background: "rgba(255, 255, 255, 0.1)",
                    padding: "4px 8px",
                    fontSize: 9,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  Travel {willingToTravel ? "Yes" : "No"}
                </span>
              )}
            </div>
            <p style={{ margin: "8px 0 0", minHeight: 20, fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
              {regionText}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>
              {city}
              {radius ? ` · ${radius} mi radius` : ""}
            </p>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                height: 56,
                alignItems: "flex-end",
                gap: 8,
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(2, 6, 23, 0.3)",
                padding: "8px 12px",
                boxSizing: "border-box",
              }}
            >
              {hasLocation &&
                [0, 1, 2].map((pin) => (
                  <span
                    key={pin}
                    style={{
                      display: "block",
                      borderRadius: 9999,
                      background: "#f87171",
                      boxShadow: "0 0 14px rgba(248, 113, 113, 0.55)",
                      height: pin === 0 ? 24 : pin === 1 ? 36 : 16,
                      width: 8,
                      opacity: regions.length > pin || baseCity ? 1 : 0.25,
                    }}
                  />
                ))}
              {hasLocation && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.45)",
                  }}
                >
                  Map pins
                </span>
              )}
            </div>
          </div>

          <div style={panel}>
            {sports.length > 0 && <p style={mutedLabel}>Eligible sports</p>}
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sports.slice(0, 6).map((item) => (
                <span
                  key={item}
                  title={item}
                  style={{
                    display: "flex",
                    height: 32,
                    width: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    border: "1px solid rgba(165, 243, 252, 0.6)",
                    background: "rgba(103, 232, 249, 0.15)",
                    fontSize: 16,
                    boxShadow: "0 0 16px rgba(103, 232, 249, 0.32)",
                  }}
                >
                  {sportIcon(item)}
                </span>
              ))}
            </div>
            {hasCertification && (
              <>
                <p style={{ ...mutedLabel, marginTop: 12 }}>Certified by</p>
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    maxWidth: "100%",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 9999,
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.1)",
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      height: 24,
                      width: 24,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background: "#ffffff",
                      color: "#dc2626",
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{certOrg}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {hasVerificationState && (
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <PdfBadge active={Boolean(profileComplete || primarySport)} label="Profile Ready" pendingLabel="Profile Pending" />
            <PdfBadge
              active={Boolean(govIdUploaded)}
              skipped={showRedUnverified}
              label="Identity Verified"
              pendingLabel="Identity Processing"
            />
            <PdfBadge
              active={Boolean(certUploaded)}
              skipped={showRedUnverified}
              label="Certified Official"
              pendingLabel="Cert Processing"
            />
            <PdfBadge
              active={screeningClear || submitted}
              skipped={showRedUnverified}
              label="Background Checked"
              pendingLabel="Background Processing"
            />
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            fontSize: 14,
          }}
        >
          <div style={panel}>
            {availability && <p style={mutedLabel}>Availability</p>}
            <p style={{ margin: availability ? "4px 0 0" : 0, minHeight: 20, fontWeight: 700, color: "#ffffff" }}>
              {availability}
            </p>
          </div>
          <div style={panel}>
            {hasStatus && <p style={mutedLabel}>Status</p>}
            <p
              style={{
                margin: hasStatus ? "4px 0 0" : 0,
                fontWeight: 700,
                textTransform: "capitalize",
                color: "#ffffff",
              }}
            >
              {screeningClear ? "Verified" : showRedUnverified ? "Unverified" : statusLabel(verificationStatus)}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            <span>Card build</span>
            <span>{percent}%</span>
          </div>
          <div
            style={{
              marginTop: 8,
              height: 8,
              overflow: "hidden",
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                borderRadius: 9999,
                backgroundImage: "linear-gradient(to right, #67e8f9, #93c5fd, #fca5a5)",
                boxShadow: "0 0 18px rgba(103, 232, 249, 0.65)",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, minHeight: 36, fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>
          {additionalSports.length > 0
            ? `Also covers: ${additionalSports.slice(0, 4).join(", ")}`
            : "Add more sports and badges as your profile grows."}
        </div>
      </div>
    </div>
  );
}
