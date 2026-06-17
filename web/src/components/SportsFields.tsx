"use client";

import { useEffect, useState } from "react";
import {
  ADDITIONAL_SPORTS,
  OTHER_SPORT_VALUE,
  PRIMARY_SPORTS,
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
  const [otherAdditional, setOtherAdditional] = useState("");

  useEffect(() => {
    const p = sportPickerFromStored(primarySport);
    setSelectValue(p.select);
    setCustomPrimary(p.custom);
  }, [primarySport]);

  function updatePrimary(select: string, custom: string) {
    setSelectValue(select);
    setCustomPrimary(custom);
    onPrimaryChange(sportPickerToStored(select, custom));
  }

  function toggle(sport: string) {
    if (additionalSports.includes(sport)) {
      onAdditionalChange(additionalSports.filter((s) => s !== sport));
    } else {
      onAdditionalChange([...additionalSports, sport]);
    }
  }

  function addCustomAdditional() {
    const trimmed = otherAdditional.trim();
    if (!trimmed || additionalSports.includes(trimmed)) return;
    onAdditionalChange([...additionalSports, trimmed]);
    setOtherAdditional("");
  }

  const customAdditionalTags = additionalSports.filter(
    (s) => !(ADDITIONAL_SPORTS as readonly string[]).includes(s) && !(PRIMARY_SPORTS as readonly string[]).includes(s)
  );

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {primaryLabel}
        <select
          className="rounded border border-[var(--border)] px-2 py-1"
          value={selectValue}
          onChange={(e) => updatePrimary(e.target.value, customPrimary)}
        >
          {PRIMARY_SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {ADDITIONAL_SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={OTHER_SPORT_VALUE}>Other (type your sport)</option>
        </select>
      </label>
      {selectValue === OTHER_SPORT_VALUE && (
        <label className="flex flex-col gap-1 text-sm">
          Your sport
          <input
            className="rounded border border-[var(--border)] px-2 py-1"
            value={customPrimary}
            placeholder="e.g. Cornhole, Bocce, Kickball"
            onChange={(e) => updatePrimary(OTHER_SPORT_VALUE, e.target.value)}
          />
        </label>
      )}
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-[var(--blue-text)]">Additional sports</legend>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Select all formats you officiate (7v7, flag football, etc.) or add your own below.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ADDITIONAL_SPORTS.map((s) => {
            const checked = additionalSports.includes(s);
            return (
              <label
                key={s}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  checked
                    ? "border-[var(--blue)] bg-[var(--blue)]/10 text-[var(--blue)]"
                    : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--blue)]/40"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(s)} />
                {s}
              </label>
            );
          })}
        </div>
        {customAdditionalTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {customAdditionalTags.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--blue)] bg-[var(--blue)]/10 px-3 py-1 text-xs font-medium text-[var(--blue)]"
              >
                {s}
                <button
                  type="button"
                  className="text-[var(--blue)] hover:opacity-70"
                  aria-label={`Remove ${s}`}
                  onClick={() => onAdditionalChange(additionalSports.filter((x) => x !== s))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[160px] flex-1 rounded border border-[var(--border)] px-2 py-1 text-sm"
            value={otherAdditional}
            placeholder="Other sport (type and add)"
            onChange={(e) => setOtherAdditional(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomAdditional();
              }
            }}
          />
          <button
            type="button"
            className="rounded border border-[var(--border)] px-3 py-1 text-xs font-medium"
            onClick={addCustomAdditional}
          >
            Add sport
          </button>
        </div>
      </fieldset>
    </>
  );
}
