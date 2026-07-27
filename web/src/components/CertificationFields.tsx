"use client";

type CertificationFieldsProps = {
  certificationLevel: string;
  additionalCertificationLevels: string[];
  onCertificationLevel: (value: string) => void;
  onAdditionalChange: (levels: string[]) => void;
  certifiedBy?: string;
  onCertifiedBy?: (value: string) => void;
  /** Visual style for Airbnb-style signup vs dashboard forms. */
  variant?: "airbnb" | "form";
  showCertifiedBy?: boolean;
};

function splitCertifiedBy(value?: string): string[] {
  if (!value?.trim()) return [""];
  const parts = value
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [""];
}

function joinCertifiedBy(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(", ");
}

export function CertificationFields({
  certificationLevel,
  additionalCertificationLevels,
  onCertificationLevel,
  onAdditionalChange,
  certifiedBy = "",
  onCertifiedBy,
  variant = "form",
  showCertifiedBy = true,
}: CertificationFieldsProps) {
  const levels = [certificationLevel, ...additionalCertificationLevels];
  const orgs = splitCertifiedBy(certifiedBy);

  function updateLevel(index: number, value: string) {
    if (index === 0) {
      onCertificationLevel(value);
      return;
    }
    const next = [...additionalCertificationLevels];
    next[index - 1] = value;
    onAdditionalChange(next);
  }

  function addLevel() {
    onAdditionalChange([...additionalCertificationLevels, ""]);
  }

  function removeLevel(index: number) {
    if (index === 0) return;
    onAdditionalChange(additionalCertificationLevels.filter((_, i) => i !== index - 1));
  }

  function updateOrg(index: number, value: string) {
    if (!onCertifiedBy) return;
    const next = [...orgs];
    next[index] = value;
    onCertifiedBy(joinCertifiedBy(next));
  }

  function addOrg() {
    if (!onCertifiedBy) return;
    onCertifiedBy(joinCertifiedBy([...orgs, ""]));
  }

  function removeOrg(index: number) {
    if (!onCertifiedBy) return;
    const next = orgs.filter((_, i) => i !== index);
    onCertifiedBy(joinCertifiedBy(next.length > 0 ? next : [""]));
  }

  const labelClass =
    variant === "airbnb" ? "text-xs text-neutral-500" : "text-sm font-bold text-[var(--navy)]";
  const fieldClass =
    variant === "airbnb"
      ? "mt-4 block rounded-2xl border border-neutral-300 px-5 py-4 first:mt-8"
      : "block";
  const inputClass =
    variant === "airbnb"
      ? "mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 placeholder:text-neutral-400 outline-none"
      : "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3";
  const addBtnClass =
    variant === "airbnb"
      ? "mt-3 text-sm font-semibold text-neutral-800 underline-offset-2 hover:underline"
      : "mt-2 text-sm font-semibold text-[var(--blue)] hover:underline";

  return (
    <div className={variant === "form" ? "space-y-4" : "space-y-0"}>
      {levels.map((level, index) => (
        <label key={`cert-level-${index}`} className={fieldClass}>
          <span className={labelClass}>
            {index === 0 ? "Certification level" : `Certification level ${index + 1}`}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className={inputClass}
              value={level}
              onChange={(event) => updateLevel(index, event.target.value)}
              placeholder={
                index === 0 ? "Youth, varsity, Grade 7, etc." : "Another level or credential"
              }
            />
            {index > 0 ? (
              <button
                type="button"
                onClick={() => removeLevel(index)}
                className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600"
              >
                Remove
              </button>
            ) : null}
          </div>
        </label>
      ))}
      <button type="button" onClick={addLevel} className={addBtnClass}>
        + Add another certification
      </button>

      {showCertifiedBy && onCertifiedBy ? (
        <>
          {orgs.map((org, index) => (
            <label
              key={`cert-org-${index}`}
              className={
                variant === "airbnb"
                  ? "mt-4 block rounded-2xl border border-neutral-300 px-5 py-4"
                  : "block"
              }
            >
              <span className={labelClass}>
                {index === 0 ? "Certified by / association" : `Association ${index + 1}`}
                {index === 0 ? (
                  <span className="font-medium text-neutral-400"> (optional)</span>
                ) : null}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className={inputClass}
                  value={org}
                  onChange={(event) => updateOrg(index, event.target.value)}
                  placeholder="NFHS, state association, USSF, etc."
                />
                {index > 0 || (orgs.length > 1 && index === 0) ? (
                  <button
                    type="button"
                    onClick={() => removeOrg(index)}
                    className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-red-600"
                    disabled={orgs.length === 1 && !org.trim()}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </label>
          ))}
          <button type="button" onClick={addOrg} className={addBtnClass}>
            + Add another association
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Primary + extras, skipping blanks and duplicates. */
export function normalizeCertificationLevels(
  primary: string,
  additional: string[]
): { certificationLevel: string; additionalCertificationLevels: string[] } {
  const cleaned = [primary, ...additional]
    .map((item) => item.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const item of cleaned) {
    if (!unique.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
      unique.push(item);
    }
  }
  return {
    certificationLevel: unique[0] ?? "",
    additionalCertificationLevels: unique.slice(1),
  };
}

export function allCertificationLevels(
  primary?: string | null,
  additional?: string[] | null
): string[] {
  return [primary ?? "", ...(additional ?? [])]
    .map((item) => item.trim())
    .filter(Boolean);
}
