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
    queueMicrotask(() => {
      const p = sportPickerFromStored(primarySport);
      setSelectValue(p.select);
      setCustomPrimary(p.custom);
    });
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
        <div className="relative">
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-semibold text-[var(--navy)] outline-none transition-all duration-200 focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/15"
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
            placeholder="e.g., Flag Football, Pickleball..."
            onChange={(e) => updatePrimary(OTHER_SPORT_VALUE, e.target.value)}
          />
        </label>
      )}
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-[var(--blue-text)]">Additional sports</legend>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Add any other sports or formats you want people to find you for.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
          {ADDITIONAL_SPORTS.map((s) => {
            const checked = additionalSports.includes(s);
            return (
              <label
                key={s}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-black transition-all duration-200 ${
                  checked
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:scale-[1.02] hover:border-[var(--blue)]/50 hover:bg-white hover:text-[var(--navy)]"
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
                className="inline-flex items-center gap-1 rounded-full border border-[var(--navy)] bg-[var(--navy)] px-3 py-1.5 text-xs font-black text-white shadow-sm"
              >
                {s}
                <button
                  type="button"
                  className="text-white/80 transition-opacity duration-200 hover:opacity-70"
                  aria-label={`Remove ${s}`}
                  onClick={() => onAdditionalChange(additionalSports.filter((x) => x !== s))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[var(--blue)]/15">
          <input
            className="min-w-0 flex-1 border-0 px-3 py-2.5 text-sm outline-none"
            value={otherAdditional}
            placeholder="e.g., Flag Football, Pickleball..."
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
            className="border-l border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-[var(--navy)] transition-all duration-200 hover:bg-slate-100"
            onClick={addCustomAdditional}
          >
            Add sport
          </button>
        </div>
      </fieldset>
    </>
  );
}
