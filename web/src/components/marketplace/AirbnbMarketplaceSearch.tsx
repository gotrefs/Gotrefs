"use client";

import type { ReactNode } from "react";

type SearchField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "select" | "date";
  options?: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  /** Optional custom control (e.g. Places autocomplete). */
  renderInput?: () => ReactNode;
};

export function AirbnbMarketplaceSearch({
  fields,
  onSearch,
  searchLabel = "Search",
  compact = false,
}: {
  fields: SearchField[];
  onSearch?: () => void;
  searchLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0 rounded-[2rem] border border-neutral-200 bg-white p-2 transition-shadow md:flex-row md:items-stretch md:rounded-full ${compact ? "shadow-md" : "shadow-[0_6px_20px_rgba(0,0,0,0.1)]"}`}
    >
      {fields.map((field, index) => (
        <div
          key={field.id}
          className={`group relative min-w-0 flex-1 px-4 py-3 transition hover:bg-neutral-100 md:rounded-full md:py-3.5 ${field.className ?? ""} ${index > 0 ? "md:border-l md:border-neutral-200" : ""}`}
        >
          <label htmlFor={field.id} className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-800">
            {field.label}
          </label>
          {field.renderInput ? (
            field.renderInput()
          ) : field.type === "select" ? (
            <select
              id={field.id}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="mt-0.5 w-full truncate border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 outline-none focus:ring-0"
            >
              {field.options?.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.id}
              type={field.type === "date" ? "date" : "text"}
              value={field.value}
              placeholder={field.placeholder}
              onChange={(e) => field.onChange(e.target.value)}
              className="mt-0.5 w-full truncate border-0 bg-transparent p-0 text-sm font-medium text-neutral-600 placeholder:text-neutral-400 outline-none focus:ring-0"
            />
          )}
        </div>
      ))}
      <div className="flex items-center p-1 md:pl-0">
        <button
          type="button"
          onClick={onSearch}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--red)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--red-dark)] md:h-12 md:w-12 md:px-0"
          aria-label={searchLabel}
        >
          <span className="md:hidden">{searchLabel}</span>
          <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M13 4a9 9 0 1 0 5.29 16.29l6.71 6.7a1 1 0 0 0 1.42-1.42l-6.7-6.71A9 9 0 0 0 13 4Zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
