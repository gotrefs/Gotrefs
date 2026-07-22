"use client";

import { useState, type ReactNode } from "react";
import { ALL_SPORTS } from "@/data/sports";
import { marketplaceCardShadow } from "@/lib/marketplace/airbnb-styles";

export type ComposerEventValues = {
  title: string;
  sport: string;
  starts: string;
  ends: string;
  city: string;
  state: string;
  zip: string;
  needed: number;
  pay: string;
  payType: "exact" | "range";
  payMin: string;
  payMax: string;
  notes: string;
};

export type JustPublishedEvent = {
  id?: string;
  title: string;
  whenLabel: string;
  whereLabel: string;
};

type OrganizerEventComposerProps = {
  values: ComposerEventValues;
  onChange: (patch: Partial<ComposerEventValues>) => void;
  onPublish: () => void | Promise<void>;
  onDone: () => void;
  publishing?: boolean;
  justPublished: JustPublishedEvent[];
  error?: string | null;
  onClearError?: () => void;
  onImportCsv?: (file: File) => void | Promise<void>;
  showCsvImport?: boolean;
  eventsListSaved?: boolean;
};

function FieldShell({
  label,
  htmlFor,
  children,
  hint,
  required,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 transition hover:bg-neutral-50">
      <label htmlFor={htmlFor} className="block text-[10px] font-semibold uppercase tracking-wide text-neutral-800">
        {label}
        {required ? <span className="ml-1 text-[var(--red)]">*</span> : null}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

const inputClass =
  "w-full border-0 bg-transparent p-0 text-sm font-medium text-neutral-800 placeholder:text-neutral-400 outline-none focus:ring-0";

export function OrganizerEventComposer({
  values,
  onChange,
  onPublish,
  onDone,
  publishing = false,
  justPublished,
  error,
  onClearError,
  onImportCsv,
  showCsvImport = true,
  eventsListSaved = false,
}: OrganizerEventComposerProps) {
  const [notesOpen, setNotesOpen] = useState(Boolean(values.notes));
  const [csvOpen, setCsvOpen] = useState(false);
  const zipTrim = values.zip.trim();
  const zipIsValid = /^\d{5}(-\d{4})?$/.test(zipTrim);
  const hasPublished = justPublished.length > 0;

  function patch(next: Partial<ComposerEventValues>) {
    onClearError?.();
    onChange(next);
  }

  return (
    <div className="space-y-5">
      {hasPublished ? (
        <div className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${marketplaceCardShadow}`}>
          <div className="border-b border-neutral-100 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Just published</p>
            <p className="mt-1 text-sm text-neutral-600">
              {justPublished.length} event{justPublished.length === 1 ? "" : "s"} ready for staffing
            </p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {justPublished.map((event, index) => (
              <li key={event.id ?? `${event.title}-${index}`} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                  ✓
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{event.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {event.whenLabel}
                    {event.whereLabel ? ` · ${event.whereLabel}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${marketplaceCardShadow}`}
        onSubmit={(e) => {
          e.preventDefault();
          void onPublish();
        }}
      >
        <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {hasPublished ? "Add another event" : "Create an event"}
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
            {hasPublished ? "Same venue, next game" : "When and where is the game?"}
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            {hasPublished
              ? "Venue and pay stay filled in — just set the next start time."
              : "Publish one game at a time. You can add more right after."}
          </p>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-900">When</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldShell label="Start" htmlFor="composer-starts" required>
                <input
                  id="composer-starts"
                  type="datetime-local"
                  required
                  className={inputClass}
                  value={values.starts}
                  onChange={(e) => patch({ starts: e.target.value })}
                />
              </FieldShell>
              <FieldShell label="End" htmlFor="composer-ends" hint="Defaults to start + 2 hours if left blank">
                <input
                  id="composer-ends"
                  type="datetime-local"
                  className={inputClass}
                  value={values.ends}
                  onChange={(e) => patch({ ends: e.target.value })}
                />
              </FieldShell>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-900">Where</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <FieldShell label="City" htmlFor="composer-city">
                <input
                  id="composer-city"
                  className={inputClass}
                  placeholder="Los Angeles"
                  value={values.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
              </FieldShell>
              <FieldShell label="State" htmlFor="composer-state">
                <input
                  id="composer-state"
                  className={inputClass}
                  placeholder="CA"
                  value={values.state}
                  onChange={(e) => patch({ state: e.target.value })}
                />
              </FieldShell>
              <FieldShell
                label="ZIP"
                htmlFor="composer-zip"
                required
                hint={
                  zipTrim && !zipIsValid
                    ? "Use a 5-digit ZIP so refs can match by area."
                    : zipTrim && zipIsValid
                      ? "Looks good"
                      : undefined
                }
              >
                <div className="relative">
                  <input
                    id="composer-zip"
                    required
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="91322"
                    className={`${inputClass} pr-6 ${zipTrim && zipIsValid ? "text-emerald-800" : ""}`}
                    value={values.zip}
                    onChange={(e) => patch({ zip: e.target.value })}
                  />
                  {zipTrim && zipIsValid ? (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-600">
                      ✓
                    </span>
                  ) : null}
                </div>
              </FieldShell>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-900">Game details</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <FieldShell label="Title" htmlFor="composer-title">
                <input
                  id="composer-title"
                  className={inputClass}
                  placeholder="Saturday varsity"
                  value={values.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </FieldShell>
              <FieldShell label="Sport" htmlFor="composer-sport">
                <select
                  id="composer-sport"
                  className={inputClass}
                  value={values.sport}
                  onChange={(e) => patch({ sport: e.target.value })}
                >
                  {ALL_SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FieldShell>
              <FieldShell label="Officials needed" htmlFor="composer-needed">
                <input
                  id="composer-needed"
                  type="number"
                  min={1}
                  className={inputClass}
                  value={values.needed}
                  onChange={(e) => patch({ needed: Math.max(1, Number(e.target.value) || 1) })}
                />
              </FieldShell>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-900">Pay</p>
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-800">
                  Base pay per official
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-base font-semibold text-neutral-900">$</span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={values.pay}
                    onChange={(e) =>
                      patch({
                        pay: e.target.value,
                        payType: "exact",
                        payMin: "",
                        payMax: "",
                      })
                    }
                    placeholder="45"
                  />
                </div>
              </label>
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              className="text-sm font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-800"
            >
              {notesOpen ? "Hide notes" : "Add notes (optional)"}
            </button>
            {notesOpen ? (
              <div className="mt-2">
                <FieldShell label="Notes for refs" htmlFor="composer-notes">
                  <textarea
                    id="composer-notes"
                    rows={3}
                    className={`${inputClass} min-h-[4.5rem] resize-y`}
                    value={values.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    placeholder="Parking, check-in, uniform…"
                  />
                </FieldShell>
              </div>
            ) : null}
          </section>

          {error ? (
            <p role="status" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {hasPublished ? (
            <button
              type="button"
              onClick={onDone}
              className="order-2 text-sm font-semibold text-neutral-700 underline underline-offset-2 sm:order-1"
            >
              Done
            </button>
          ) : (
            <span className="order-2 hidden sm:order-1 sm:inline" />
          )}
          <button
            type="submit"
            disabled={publishing}
            className="order-1 w-full rounded-full bg-[var(--red)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--red-dark)] disabled:opacity-60 sm:order-2 sm:w-auto"
          >
            {publishing ? "Publishing…" : hasPublished ? "Publish another" : "Publish event"}
          </button>
        </div>
      </form>

      {showCsvImport && onImportCsv ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-3">
          <button
            type="button"
            onClick={() => setCsvOpen((open) => !open)}
            className="text-sm font-semibold text-neutral-700"
          >
            {csvOpen ? "Hide CSV import" : "Import a list (CSV)"}
          </button>
          {csvOpen ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-neutral-500">
                Columns: title, sport, starts_at, ends_at, city, state, zip, officials_needed, pay_offer.
                After upload you&apos;ll review each game one by one and can fix dates before publishing.
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.txt,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full text-sm text-neutral-700"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportCsv(file);
                }}
              />
              {eventsListSaved ? <p className="text-sm text-emerald-700">Events list file saved.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
