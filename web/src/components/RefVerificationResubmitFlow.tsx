"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { VerificationUploadField } from "@/components/VerificationUploadField";
import { CertificationFields, normalizeCertificationLevels } from "@/components/CertificationFields";
import { SportsFields } from "@/components/SportsFields";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import { formatHourlyRateRange } from "@/lib/pay-range";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import {
  REF_VERIFICATION_STEPS,
  wizardIndexForStep,
  type RefVerificationStepKey,
} from "@/lib/ref-verification-steps";

const WORK_REGION_OPTIONS = ["Local city", "County-wide", "Statewide", "Neighboring states", "Tournament travel"];
const HOURLY_RATE_FLOOR = 10;
const HOURLY_RATE_CEILING = 150;

type RefVerificationResubmitFlowProps = {
  memberId: string;
  steps: RefVerificationStepKey[];
  adminMessage?: string;
  mode?: "resubmit" | "edit";
  initialStep?: RefVerificationStepKey;
  existingGovId?: boolean;
  existingCert?: boolean;
  /** Existing face photo already on the official ID card (signed URL or blob). */
  existingAvatarUrl?: string | null;
  initialHourlyRateMin?: string;
  initialHourlyRateMax?: string;
  displayName: string;
  primarySport: string;
  additionalSports: string[];
  certificationLevel: string;
  additionalCertificationLevels?: string[];
  certifiedBy?: string;
  baseCity: string;
  travelRadius: string;
  workRegions: string[];
  gotrefsId?: string;
  /** Called as soon as a new face photo is picked (blob URL) and again after it saves. */
  onProfilePhotoUpdated?: (previewUrl: string) => void;
  onComplete: () => void;
  onClose?: () => void;
};

async function uploadFile(userId: string, file: File, prefix: string) {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${userId}/${prefix}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("verification_documents").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export function RefVerificationResubmitFlow({
  memberId,
  steps,
  adminMessage = "",
  mode = "resubmit",
  initialStep,
  existingGovId = false,
  existingCert = false,
  existingAvatarUrl = null,
  initialHourlyRateMin = String(HOURLY_RATE_FLOOR),
  initialHourlyRateMax = "75",
  displayName: initialDisplayName,
  primarySport: initialPrimarySport,
  additionalSports: initialAdditionalSports,
  certificationLevel: initialCertificationLevel,
  additionalCertificationLevels: initialAdditionalCertificationLevels = [],
  certifiedBy: initialCertifiedBy = "",
  baseCity: initialBaseCity,
  travelRadius: initialTravelRadius,
  workRegions: initialWorkRegions,
  gotrefsId,
  onProfilePhotoUpdated,
  onComplete,
  onClose,
}: RefVerificationResubmitFlowProps) {
  const supabase = useMemo(() => createClient(), []);
  const orderedSteps = useMemo(
    () => REF_VERIFICATION_STEPS.map((step) => step.key).filter((key) => steps.includes(key)),
    [steps]
  );
  const [wizardIndex, setWizardIndex] = useState(() =>
    initialStep ? wizardIndexForStep(orderedSteps, initialStep) : 0
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(initialDisplayName);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const cardPhotoUrl = photoPreviewUrl || existingAvatarUrl || null;
  const onPhotoUpdatedRef = useRef(onProfilePhotoUpdated);
  onPhotoUpdatedRef.current = onProfilePhotoUpdated;
  const [primarySport, setPrimarySport] = useState(initialPrimarySport);
  const [additionalSports, setAdditionalSports] = useState(initialAdditionalSports);
  const [certificationLevel, setCertificationLevel] = useState(initialCertificationLevel);
  const [additionalCertificationLevels, setAdditionalCertificationLevels] = useState(
    initialAdditionalCertificationLevels
  );
  const [certifiedBy, setCertifiedBy] = useState(initialCertifiedBy);
  const [hourlyRateMin, setHourlyRateMin] = useState(initialHourlyRateMin);
  const [hourlyRateMax, setHourlyRateMax] = useState(initialHourlyRateMax);
  const [govIdFrontFile, setGovIdFrontFile] = useState<File | null>(null);
  const [govIdBackFile, setGovIdBackFile] = useState<File | null>(null);
  const [certDocFile, setCertDocFile] = useState<File | null>(null);
  const [baseCity, setBaseCity] = useState(initialBaseCity);
  const [travelRadius, setTravelRadius] = useState(initialTravelRadius || "25");
  const [workRegions, setWorkRegions] = useState(initialWorkRegions);

  useEffect(() => {
    if (initialStep) {
      setWizardIndex(wizardIndexForStep(orderedSteps, initialStep));
    }
  }, [initialStep, orderedSteps]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    onPhotoUpdatedRef.current?.(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const currentStep = orderedSteps[wizardIndex];
  const currentMeta = REF_VERIFICATION_STEPS.find((step) => step.key === currentStep);
  const isEditMode = mode === "edit";

  function toggleRegion(region: string) {
    setWorkRegions((current) =>
      current.includes(region) ? current.filter((item) => item !== region) : [...current, region]
    );
  }

  function validateCurrentStep(): string | null {
    if (currentStep === "profile") {
      if (!fullName.trim()) return "Enter your name.";
      if (fullName.trim().length > 100) return "Name is too long.";
      // Admin-requested profile resubmit needs a new face photo only if none is on file yet.
      if (mode === "resubmit" && !photoFile && !existingAvatarUrl) {
        return "Upload a clear photo of your face to continue.";
      }
    }
    if (currentStep === "sports") {
      const sport = primarySport.trim();
      if (!sport) return "Select or enter your primary sport.";
      if (!certificationLevel.trim()) return "Enter your certification level.";
      const minRate = Number(hourlyRateMin);
      const maxRate = Number(hourlyRateMax);
      if (!Number.isFinite(minRate) || minRate < HOURLY_RATE_FLOOR) {
        return `Set your minimum hourly rate to at least $${HOURLY_RATE_FLOOR}.`;
      }
      if (!Number.isFinite(maxRate) || maxRate < minRate) {
        return "Maximum hourly rate must be at least your minimum.";
      }
      if (maxRate > HOURLY_RATE_CEILING) {
        return `Maximum hourly rate cannot exceed $${HOURLY_RATE_CEILING}.`;
      }
    }
    if (currentStep === "government_id") {
      const hasNewUploads = Boolean(govIdFrontFile && govIdBackFile);
      if (!existingGovId && !hasNewUploads) return "Upload the front and back of your government ID.";
      if ((govIdFrontFile && !govIdBackFile) || (!govIdFrontFile && govIdBackFile)) {
        return "Upload both the front and back of your government ID.";
      }
    }
    if (currentStep === "certification") {
      if (!existingCert && !certDocFile) return "Upload your certification or license document.";
    }
    if (currentStep === "location") {
      if (!baseCity.trim()) return "Enter your base city.";
    }
    return null;
  }

  async function saveCurrentStep() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    try {
    if (currentStep === "profile") {
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ");
      let profilePictureUrl: string | null = null;
      if (photoFile) {
        profilePictureUrl = await uploadFile(memberId, photoFile, "profile_photo");
      }
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          first_name: firstName,
          last_name: lastName,
          ...(profilePictureUrl ? { profile_picture_url: profilePictureUrl } : {}),
        },
      });
      const { error: memberError } = await supabase
        .from("members")
        .update({
          display_name: fullName.trim(),
          first_name: firstName,
          last_name: lastName,
          ...(profilePictureUrl ? { profile_picture_url: profilePictureUrl } : {}),
        })
        .eq("id", memberId);
      if (memberError) throw memberError;

      if (profilePictureUrl) {
        const signed = await resolveProfilePhotoUrl(supabase, profilePictureUrl);
        if (signed) onProfilePhotoUpdated?.(signed);
      }
    }

    if (currentStep === "sports") {
      const resolvedSport = primarySport.trim();
      const minRate = Number(hourlyRateMin);
      const maxRate = Number(hourlyRateMax);
      const resolvedCerts = normalizeCertificationLevels(
        certificationLevel,
        additionalCertificationLevels
      );
      const { error: profileUpdateError } = await supabase
        .from("ref_profiles")
        .update({
          primary_sport: resolvedSport,
          additional_sports: additionalSports.filter((sport) => sport !== resolvedSport),
          certification_level: resolvedCerts.certificationLevel,
          additional_certification_levels: resolvedCerts.additionalCertificationLevels,
          rate_type: "range",
          rate_min: minRate,
          rate_max: maxRate,
          rate_per_game: minRate,
          rate_unit: "hour",
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", memberId);
      if (
        profileUpdateError &&
        /additional_certification_levels/i.test(profileUpdateError.message)
      ) {
        const { error: legacyError } = await supabase
          .from("ref_profiles")
          .update({
            primary_sport: resolvedSport,
            additional_sports: additionalSports.filter((sport) => sport !== resolvedSport),
            certification_level: resolvedCerts.certificationLevel,
            rate_type: "range",
            rate_min: minRate,
            rate_max: maxRate,
            rate_per_game: minRate,
            rate_unit: "hour",
            updated_at: new Date().toISOString(),
          })
          .eq("member_id", memberId);
        if (legacyError) throw legacyError;
      } else if (profileUpdateError) {
        throw profileUpdateError;
      }
      await supabase.auth.updateUser({
        data: {
          primary_sport: resolvedSport,
          certification_level: resolvedCerts.certificationLevel,
          additional_certification_levels: resolvedCerts.additionalCertificationLevels,
          certified_by: certifiedBy.trim() || null,
        },
      });
    }

    if (currentStep === "government_id" && govIdFrontFile && govIdBackFile) {
      const [frontPath, backPath] = await Promise.all([
        uploadFile(memberId, govIdFrontFile, "gov_id_front"),
        uploadFile(memberId, govIdBackFile, "gov_id_back"),
      ]);
      const { error: idUpdateError } = await supabase
        .from("ref_profiles")
        .update({
          government_id_path: frontPath,
          verification_doc_path: backPath,
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", memberId);
      if (idUpdateError) throw idUpdateError;
    }

    if (currentStep === "certification" && certDocFile) {
      const certPath = await uploadFile(memberId, certDocFile, "certification");
      const { error: certUpdateError } = await supabase
        .from("ref_profiles")
        .update({
          certification_document_path: certPath,
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", memberId);
      if (certUpdateError) throw certUpdateError;
    }

    if (currentStep === "location") {
      await supabase.auth.updateUser({
        data: {
          base_city: baseCity.trim(),
          travel_radius_miles: Number(travelRadius) || null,
          work_regions: workRegions,
        },
      });
    }

    if (wizardIndex < orderedSteps.length - 1) {
      setWizardIndex((index) => index + 1);
      return;
    }

    if (isEditMode) {
      setSuccess(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/verification/resubmit", { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not resubmit your application.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this step. Try again.");
    }
  }

  if (success) {
    return (
      <section className="w-full rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700">
          {isEditMode ? "Profile updated" : "Application successfully submitted"}
        </p>
        <h2 className="mt-2 font-display text-2xl font-black text-[var(--navy)]">
          {isEditMode ? "Your changes are saved" : "Thanks — we received your updates"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--slate)]">
          {isEditMode
            ? "Your ref ID card reflects the updates you made."
            : "Your fixes were sent back to GotRefs for review. We'll notify you when your verification is updated."}
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-5 rounded-full bg-green-600 px-5 py-2.5 text-sm font-black text-white"
        >
          Back to dashboard
        </button>
      </section>
    );
  }

  return (
    <section className="relative w-full rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-[var(--border)] px-3 py-1 text-sm font-bold text-[var(--muted)]"
        >
          Close
        </button>
      )}
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">
        {isEditMode ? "Update your profile" : "Fix & resubmit"}
      </p>
      <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">
        {isEditMode
          ? `Step ${currentMeta?.number ?? wizardIndex + 1} of ${REF_VERIFICATION_STEPS.length}: ${currentMeta?.label ?? ""}`
          : `Resubmit ${currentMeta?.shortLabel ?? "item"} (${wizardIndex + 1} of ${orderedSteps.length})`}
      </h2>
      {!isEditMode && adminMessage && (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-bold">From GotRefs: </span>
          {adminMessage}
        </p>
      )}
      {isEditMode ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Update your details the same way you signed up. Use Back and Continue to move between steps.
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Complete only the items GotRefs requested:{" "}
          {orderedSteps
            .map((key) => REF_VERIFICATION_STEPS.find((step) => step.key === key)?.shortLabel)
            .filter(Boolean)
            .join(", ")}
          .
        </p>
      )}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--navy)] to-emerald-600 transition-all"
          style={{
            width: `${((wizardIndex + 1) / Math.max(orderedSteps.length, 1)) * 100}%`,
          }}
        />
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-[var(--red)]">{error}</p>}

      <div className="mt-5 space-y-4">
        {currentStep === "profile" && (
          <>
            <label className="block text-sm font-bold text-[var(--navy)]">
              Full name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            </label>
            <p className="text-sm font-semibold text-[var(--muted)]">
              {existingAvatarUrl && !photoFile
                ? "Your signup photo is already on your GotRefs ID card. Replace it only if you want a new one."
                : "Upload a clear face photo — it updates your GotRefs ID card immediately."}
            </p>
            <label
              className={`relative block cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                photoFile || existingAvatarUrl
                  ? "border-green-400 bg-green-50"
                  : "border-[var(--blue)]/40 bg-slate-50 hover:border-[var(--blue)]"
              }`}
            >
              {photoFile || existingAvatarUrl ? (
                <>
                  <span className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-green-500 text-2xl font-black text-white">
                    {cardPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cardPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-2xl font-black text-white">
                      ✓
                    </span>
                  </span>
                  <span className="mt-3 block text-sm font-bold text-green-800">
                    {photoFile ? "Profile photo uploaded" : "Profile photo already on your ID card"}
                  </span>
                  <span className="mt-1 block text-xs text-green-700/80">
                    {photoFile ? `${photoFile.name} · tap to replace` : "Tap to replace anytime"}
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-[var(--navy)]">Upload profile photo</span>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/*"
                className="sr-only"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="mx-auto w-full max-w-[360px] pt-2">
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                Your GotRefs ID card
              </p>
              <RefereeIdCard
                fullName={fullName}
                gotrefsId={gotrefsId}
                avatarUrl={cardPhotoUrl ?? undefined}
                avatarLabel={
                  fullName
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("") || "REF"
                }
                primarySport={primarySport || undefined}
                additionalSports={additionalSports}
                certificationLevel={certificationLevel || undefined}
                additionalCertificationLevels={additionalCertificationLevels}
                certifiedBy={certifiedBy || undefined}
                baseCity={baseCity || undefined}
                emptyPlaceholders
                onUploadPhoto={(file) => setPhotoFile(file)}
              />
            </div>
          </>
        )}

        {currentStep === "sports" && (
          <>
            <SportsFields
              primarySport={primarySport}
              additionalSports={additionalSports}
              onPrimaryChange={setPrimarySport}
              onAdditionalChange={setAdditionalSports}
            />
            <CertificationFields
              variant="form"
              certificationLevel={certificationLevel}
              additionalCertificationLevels={additionalCertificationLevels}
              onCertificationLevel={setCertificationLevel}
              onAdditionalChange={setAdditionalCertificationLevels}
              certifiedBy={certifiedBy}
              onCertifiedBy={setCertifiedBy}
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-[var(--navy)]">Your hourly rate range</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Drag both ends. The left end starts at ${HOURLY_RATE_FLOOR}/hr.
              </p>
              {(() => {
                const minVal = Number(hourlyRateMin) || HOURLY_RATE_FLOOR;
                const maxVal = Number(hourlyRateMax) || HOURLY_RATE_FLOOR;
                const span = HOURLY_RATE_CEILING - HOURLY_RATE_FLOOR;
                const leftPct = ((minVal - HOURLY_RATE_FLOOR) / span) * 100;
                const rightPct = ((maxVal - HOURLY_RATE_FLOOR) / span) * 100;
                return (
                  <>
                    <p className="mt-3 text-lg font-black text-[var(--navy)]">
                      {formatHourlyRateRange(minVal, maxVal)}
                    </p>
                    <div className="dual-range relative mt-6 h-8">
                      <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
                      <div
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--navy)]"
                        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
                      />
                      <input
                        type="range"
                        min={HOURLY_RATE_FLOOR}
                        max={HOURLY_RATE_CEILING}
                        step={5}
                        value={minVal}
                        onChange={(event) => {
                          const next = Math.min(Number(event.target.value), maxVal);
                          setHourlyRateMin(String(Math.max(HOURLY_RATE_FLOOR, next)));
                        }}
                        aria-label="Minimum hourly rate"
                      />
                      <input
                        type="range"
                        min={HOURLY_RATE_FLOOR}
                        max={HOURLY_RATE_CEILING}
                        step={5}
                        value={maxVal}
                        onChange={(event) => {
                          const next = Math.max(Number(event.target.value), minVal);
                          setHourlyRateMax(String(Math.min(HOURLY_RATE_CEILING, next)));
                        }}
                        aria-label="Maximum hourly rate"
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold text-[var(--muted)]">
                      <span>${HOURLY_RATE_FLOOR}/hr</span>
                      <span>
                        ${minVal} – ${maxVal}/hr
                      </span>
                      <span>${HOURLY_RATE_CEILING}/hr</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {currentStep === "government_id" && (
          <>
            {existingGovId && (
              <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                ✓ Government ID already on file. Upload new photos only if you need to replace them.
              </p>
            )}
            <VerificationUploadField
              title="Government ID — front"
              description="Upload a clear photo of the front of your ID."
              uploaded={Boolean(govIdFrontFile)}
              uploadedLabel={`✓ ${govIdFrontFile?.name ?? "Front uploaded"}`}
              onFile={(event) => setGovIdFrontFile(event.target.files?.[0] ?? null)}
            />
            <VerificationUploadField
              title="Government ID — back"
              description="Upload a clear photo of the back of your ID."
              uploaded={Boolean(govIdBackFile)}
              uploadedLabel={`✓ ${govIdBackFile?.name ?? "Back uploaded"}`}
              onFile={(event) => setGovIdBackFile(event.target.files?.[0] ?? null)}
            />
          </>
        )}

        {currentStep === "certification" && (
          <>
            {existingCert && (
              <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                ✓ Certification document already on file. Upload a new file only if you need to replace it.
              </p>
            )}
            <VerificationUploadField
              title="Certification / license document"
              description="Upload your referee certification, license, or training credential."
              uploaded={Boolean(certDocFile)}
              uploadedLabel={`✓ ${certDocFile?.name ?? "Document uploaded"}`}
              onFile={(event) => setCertDocFile(event.target.files?.[0] ?? null)}
            />
          </>
        )}

        {currentStep === "location" && (
          <>
            <label className="block text-sm font-bold text-[var(--navy)]">
              Base city
              <input
                value={baseCity}
                onChange={(event) => setBaseCity(event.target.value)}
                placeholder="Phoenix, AZ"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
              />
            </label>
            <label className="block text-sm font-bold text-[var(--navy)]">
              Travel radius: {travelRadius || 0} miles
              <input
                type="range"
                min={5}
                max={150}
                value={travelRadius}
                onChange={(event) => setTravelRadius(event.target.value)}
                className="mt-3 w-full accent-[var(--navy)]"
              />
            </label>
            <div>
              <p className="text-sm font-bold text-[var(--navy)]">Regions willing to work</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WORK_REGION_OPTIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      workRegions.includes(region)
                        ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                        : "border-slate-200 text-[var(--muted)]"
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={wizardIndex === 0 || submitting}
          onClick={() => setWizardIndex((index) => Math.max(0, index - 1))}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void saveCurrentStep()}
          className="rounded-full bg-[var(--red)] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
        >
          {submitting
            ? "Saving…"
            : wizardIndex === orderedSteps.length - 1
              ? isEditMode
                ? "Save changes"
                : "Resubmit"
              : `Continue to step ${REF_VERIFICATION_STEPS.find((step) => step.key === orderedSteps[wizardIndex + 1])?.number ?? wizardIndex + 2}`}
        </button>
      </div>
    </section>
  );
}
