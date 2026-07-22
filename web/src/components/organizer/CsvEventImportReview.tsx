"use client";

import { useMemo, useState } from "react";
import { ALL_SPORTS } from "@/data/sports";
import type { ParsedCsvEvent } from "@/lib/marketplace/parse-events-csv";

type CsvEventImportReviewProps = {
  rows: ParsedCsvEvent[];
  parseErrors?: string[];
  publishing?: boolean;
  onClose: () => void;
  onPublishOne: (row: ParsedCsvEvent, index: number) => Promise<boolean>;
};

export function CsvEventImportReview({
  rows,
  parseErrors = [],
  publishing = false,
  onClose,
  onPublishOne,
}: CsvEventImportReviewProps) {
  const [drafts, setDrafts] = useState<ParsedCsvEvent[]>(() => rows.map((row) => ({ ...row })));
  const [index, setIndex] = useState(0);
  const [published, setPublished] = useState<Set<number>>(() => new Set());
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set());
  const [localError, setLocalError] = useState<string | null>(null);

  const current = drafts[index] ?? null;
  const doneCount = published.size + skipped.size;
  const remaining = drafts.length - doneCount;

  const statusLabel = useMemo(() => {
    if (!current) return "";
    if (published.has(index)) return "Published";
    if (skipped.has(index)) return "Skipped";
    return "Needs review";
  }, [current, index, published, skipped]);

  function patchCurrent(patch: Partial<ParsedCsvEvent>) {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setLocalError(null);
  }

  function validateCurrent(row: ParsedCsvEvent): string | null {
    if (!row.title.trim()) return "Add an event title.";
    if (!row.sport.trim()) return "Pick a sport.";
    if (!row.starts_local) return "Set a start date and time.";
    const start = new Date(row.starts_local);
    if (Number.isNaN(start.getTime())) return "Start date/time is invalid.";
    if (row.ends_local) {
      const end = new Date(row.ends_local);
      if (Number.isNaN(end.getTime())) return "End date/time is invalid.";
      if (end.getTime() < start.getTime()) return "End must be after start.";
    }
    if (row.zip_code && !/^\d{5}(-\d{4})?$/.test(row.zip_code.trim())) {
      return "Enter a valid 5-digit ZIP (or ZIP+4).";
    }
    return null;
  }

  async function handlePublish() {
    if (!current) return;
    const err = validateCurrent(current);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    const ok = await onPublishOne(current, index);
    if (!ok) return;
    setPublished((prev) => new Set(prev).add(index));
    if (index < drafts.length - 1) setIndex(index + 1);
  }

  function handleSkip() {
    setSkipped((prev) => new Set(prev).add(index));
    setLocalError(null);
    if (index < drafts.length - 1) setIndex(index + 1);
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-neutral-900">No games to review</h2>
          {parseErrors.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <button type="button" aria-label="Dismiss" className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--red)]">CSV import review</p>
              <h2 className="mt-1 text-xl font-bold text-neutral-900">
                Game {index + 1} of {drafts.length}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Fix dates or details, then publish one at a time. Nothing goes live until you publish.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm font-semibold text-neutral-600"
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{published.size} published</span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-600">{skipped.size} skipped</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{remaining} left</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">{statusLabel}</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {parseErrors.length > 0 && index === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Some CSV rows need attention</p>
              <ul className="mt-1 list-disc pl-5">
                {parseErrors.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {parseErrors.length > 5 ? (
                <p className="mt-1 text-xs">+{parseErrors.length - 5} more parse notes</p>
              ) : null}
            </div>
          )}

          {current.parseWarning && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Row {current.rowNumber}: {current.parseWarning}
            </p>
          )}

          <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
            <span className="text-xs font-semibold text-neutral-500">Event title</span>
            <input
              className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
              value={current.title}
              onChange={(e) => patchCurrent({ title: e.target.value })}
            />
          </label>

          <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
            <span className="text-xs font-semibold text-neutral-500">Sport</span>
            <select
              className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
              value={current.sport}
              onChange={(e) => patchCurrent({ sport: e.target.value })}
            >
              {!(ALL_SPORTS as readonly string[]).includes(current.sport) && current.sport ? (
                <option value={current.sport}>{current.sport}</option>
              ) : null}
              {ALL_SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">Starts</span>
              <input
                type="datetime-local"
                className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
                value={current.starts_local}
                onChange={(e) => patchCurrent({ starts_local: e.target.value })}
              />
            </label>
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">Ends</span>
              <input
                type="datetime-local"
                className="mt-1 w-full border-0 bg-transparent p-0 text-base text-neutral-900 outline-none"
                value={current.ends_local}
                onChange={(e) => patchCurrent({ ends_local: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3 sm:col-span-1">
              <span className="text-xs font-semibold text-neutral-500">City</span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-base outline-none"
                value={current.city ?? ""}
                onChange={(e) => patchCurrent({ city: e.target.value || null })}
              />
            </label>
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">State</span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-base outline-none"
                value={current.state ?? ""}
                onChange={(e) => patchCurrent({ state: e.target.value || null })}
              />
            </label>
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">ZIP</span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-base outline-none"
                value={current.zip_code}
                onChange={(e) => patchCurrent({ zip_code: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">Officials needed</span>
              <input
                type="number"
                min={1}
                max={30}
                className="mt-1 w-full border-0 bg-transparent p-0 text-base outline-none"
                value={current.officials_needed}
                onChange={(e) => patchCurrent({ officials_needed: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="block rounded-2xl border border-neutral-200 px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500">Pay offer ($)</span>
              <input
                type="number"
                min={0}
                step="1"
                className="mt-1 w-full border-0 bg-transparent p-0 text-base outline-none"
                value={current.pay_offer ?? ""}
                onChange={(e) =>
                  patchCurrent({
                    pay_offer: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>

          {localError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{localError}</p>
          )}
        </div>

        <div className="space-y-3 border-t border-neutral-200 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={index === 0 || publishing}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={index >= drafts.length - 1 || publishing}
              onClick={() => setIndex((i) => Math.min(drafts.length - 1, i + 1))}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                disabled={publishing || published.has(index)}
                onClick={handleSkip}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 disabled:opacity-40"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={publishing || published.has(index)}
                onClick={() => void handlePublish()}
                className="rounded-full bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {publishing ? "Publishing…" : published.has(index) ? "Published" : "Publish this game"}
              </button>
            </div>
          </div>
          {remaining === 0 && (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Done — {published.size} game{published.size === 1 ? "" : "s"} posted
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
