"use client";

import { useEffect, useState } from "react";
import {
  ALL_SPORTS,
  OTHER_SPORT_VALUE,
  sportPickerFromStored,
  sportPickerToStored,
} from "@/data/sports";

type SportsFieldsProps = {
  primarySport: string;
  additionalSports: string[];
  onPrimaryChange: (value: string) => void;
  onAdditionalChange: (sports: string[]) => void;
  primaryLabel?: string;
};

export function SportsFields({
  primarySport,
  additionalSports,
  onPrimaryChange,
  onAdditionalChange,
  primaryLabel = "Primary sport",
}: SportsFieldsProps) {
  const initial = sportPickerFromStored(primarySport);
  const [selectValue, setSelectValue] = useState(initial.select);
  const [customPrimary, setCustomPrimary] = useState(initial.custom);
  const secondarySport = additionalSports[0] ?? "";

  useEffect(() => {
    queueMicrotask(() => {
      const p = sportPickerFromStored(primarySport);
      setSelectValue(p.select);
      setCustomPrimary(p.custom);
    });
  }, [primarySport]);

  function updatePrimary(select: string, custom: string) {
    setSelectValue(select);
    setCustomPrimary(custom);
    const nextPrimary = sportPickerToStored(select, custom);
    onPrimaryChange(nextPrimary);
    if (secondarySport && secondarySport === nextPrimary) {
      onAdditionalChange([]);
    }
  }

  function updateSecondary(value: string) {
    if (!value.trim() || value === sportPickerToStored(selectValue, customPrimary)) {
      onAdditionalChange([]);
      return;
    }
    onAdditionalChange([value.trim()]);
  }

  const resolvedPrimary = sportPickerToStored(selectValue, customPrimary);

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {primaryLabel}
        <div className="relative">
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-[var(--navy)] outline-none transition-all duration-200 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
            value={selectValue}
            onChange={(e) => updatePrimary(e.target.value, customPrimary)}
          >
            {ALL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={OTHER_SPORT_VALUE}>Something else...</option>
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ▾
          </span>
        </div>
      </label>
      {selectValue === OTHER_SPORT_VALUE && (
        <label className="flex flex-col gap-1 text-sm">
          Your sport
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
            value={customPrimary}
            placeholder="e.g., Dodgeball"
            onChange={(e) => updatePrimary(OTHER_SPORT_VALUE, e.target.value)}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Secondary sport <span className="font-medium text-[var(--muted)]">(optional)</span>
        <div className="relative">
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-[var(--navy)] outline-none transition-all duration-200 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
            value={secondarySport === resolvedPrimary ? "" : secondarySport}
            onChange={(e) => updateSecondary(e.target.value)}
          >
            <option value="">None — primary sport only</option>
            {ALL_SPORTS.filter((s) => s !== resolvedPrimary).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ▾
          </span>
        </div>
      </label>
      <p className="text-xs text-[var(--muted)]">
        Optionally add another sport you also officiate. You can leave this blank.
      </p>
    </>
  );
}
