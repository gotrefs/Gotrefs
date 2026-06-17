"use client";

import { useState } from "react";
import { SportBadge } from "@/components/SportBadge";
import { SportsFields } from "@/components/SportsFields";
import type { AvailabilityWindow } from "@/data/sports";
import { formatPayOffer } from "@/data/sports";

export type AssignorRosterEntry = {
  id: string;
  display_name: string;
  primary_sport: string;
  additional_sports: string[];
  certification_level: string | null;
  rate_per_game: number | null;
  availability: AvailabilityWindow[] | null;
  notes: string | null;
  created_at: string;
};

type AssignorRosterPanelProps = {
  isAssignor: boolean;
  assignorSaving: boolean;
  entries: AssignorRosterEntry[];
  rosterSaving: boolean;
  onToggleAssignor: (enabled: boolean) => void;
  onAddRef: (payload: {
    display_name: string;
    primary_sport: string;
    additional_sports: string[];
    certification_level: string;
    rate_per_game: number | null;
    availability: AvailabilityWindow[];
    notes: string;
  }) => Promise<void>;
  onRemoveRef: (id: string) => void;
};

export function AssignorRosterPanel({
  isAssignor,
  assignorSaving,
  entries,
  rosterSaving,
  onToggleAssignor,
  onAddRef,
  onRemoveRef,
}: AssignorRosterPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [primarySport, setPrimarySport] = useState("Basketball");
  const [additionalSports, setAdditionalSports] = useState<string[]>([]);
  const [certLevel, setCertLevel] = useState("Youth / Recreational");
  const [rate, setRate] = useState("");
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [notes, setNotes] = useState("");

  function addAvailabilityWindow() {
    if (!availStart || !availEnd) return;
    setAvailability((prev) => [...prev, { start_at: availStart, end_at: availEnd }]);
    setAvailStart("");
    setAvailEnd("");
  }

  function resetForm() {
    setName("");
    setPrimarySport("Basketball");
    setAdditionalSports([]);
    setCertLevel("Youth / Recreational");
    setRate("");
    setAvailability([]);
    setAvailStart("");
    setAvailEnd("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rateNum = rate === "" ? null : Number(rate);
    await onAddRef({
      display_name: name.trim(),
      primary_sport: primarySport,
      additional_sports: additionalSports,
      certification_level: certLevel.trim(),
      rate_per_game: rateNum != null && Number.isFinite(rateNum) ? rateNum : null,
      availability,
      notes: notes.trim(),
    });
    resetForm();
    setFormOpen(false);
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-[var(--navy)]">Assignor roster</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Assignors track refs they already work with — same profile details as a GotREFS ref (sport, rate,
        certification, availability).
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isAssignor}
          disabled={assignorSaving}
          onChange={(e) => {
            const on = e.target.checked;
            onToggleAssignor(on);
            if (on) setFormOpen(true);
            else setFormOpen(false);
          }}
        />
        I am an assignor and manage my own ref roster
      </label>

      {isAssignor && (
        <div className="mt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-[var(--blue)]/30 bg-[var(--blue)]/5 px-4 py-3 text-left text-sm font-semibold text-[var(--blue)]"
            onClick={() => setFormOpen((o) => !o)}
            aria-expanded={formOpen}
          >
            <span>Add a ref to my roster</span>
            <span className="text-lg leading-none" aria-hidden>
              {formOpen ? "▲" : "▼"}
            </span>
          </button>

          {formOpen && (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--grey-light)]/30 p-4"
            >
              <p className="mb-4 text-xs text-[var(--muted)]">
                Enter the same information you would as a referee on GotREFS.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Ref name <span className="text-[var(--red)]">*</span>
                  <input
                    required
                    className="rounded border border-[var(--border)] px-2 py-1.5"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                  />
                </label>
                <SportsFields
                  primarySport={primarySport}
                  additionalSports={additionalSports}
                  onPrimaryChange={setPrimarySport}
                  onAdditionalChange={setAdditionalSports}
                />
                <label className="flex flex-col gap-1 text-sm">
                  Certification level
                  <input
                    className="rounded border border-[var(--border)] px-2 py-1.5"
                    value={certLevel}
                    onChange={(e) => setCertLevel(e.target.value)}
                    placeholder="Youth / Recreational, HS, College…"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Rate per game ($)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="rounded border border-[var(--border)] px-2 py-1.5"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 45"
                  />
                </label>
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-[var(--blue-text)]">Availability</p>
                  <p className="text-xs text-[var(--muted)]">Add one or more time windows when this ref can work.</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs">
                      Start
                      <input
                        type="datetime-local"
                        className="rounded border border-[var(--border)] px-2 py-1"
                        value={availStart}
                        onChange={(e) => setAvailStart(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      End
                      <input
                        type="datetime-local"
                        className="rounded border border-[var(--border)] px-2 py-1"
                        value={availEnd}
                        onChange={(e) => setAvailEnd(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium"
                      onClick={addAvailabilityWindow}
                    >
                      Add window
                    </button>
                  </div>
                  {availability.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                      {availability.map((slot, i) => (
                        <li key={`${slot.start_at}-${i}`} className="flex items-center justify-between gap-2">
                          <span>
                            {new Date(slot.start_at).toLocaleString()} → {new Date(slot.end_at).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="text-red-600 underline"
                            onClick={() => setAvailability((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Notes (optional)
                  <textarea
                    className="min-h-[64px] rounded border border-[var(--border)] px-2 py-1.5"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Travel radius, leagues, contact preference…"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={rosterSaving || !name.trim()}
                className="mt-4 rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {rosterSaving ? "Saving…" : "Save ref to roster"}
              </button>
            </form>
          )}

          <ul className="mt-6 space-y-3 text-sm">
            {entries.map((entry) => {
              const pay = formatPayOffer(entry.rate_per_game);
              const slots = Array.isArray(entry.availability) ? entry.availability : [];
              return (
                <li key={entry.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--navy)]">
                        <SportBadge sport={entry.primary_sport} className="mr-2" />
                        {entry.display_name}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        {entry.primary_sport}
                        {entry.certification_level ? ` · ${entry.certification_level}` : ""}
                        {pay ? ` · ${pay}/game` : ""}
                      </p>
                      {entry.additional_sports?.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Also: {entry.additional_sports.join(", ")}
                        </p>
                      )}
                      {slots.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                          {slots.slice(0, 2).map((slot, i) => (
                            <li key={`${entry.id}-av-${i}`}>
                              Available {new Date(slot.start_at).toLocaleString()} –{" "}
                              {new Date(slot.end_at).toLocaleString()}
                            </li>
                          ))}
                          {slots.length > 2 && <li>+{slots.length - 2} more window(s)</li>}
                        </ul>
                      )}
                      {entry.notes && <p className="mt-1 text-xs text-[var(--slate)]">{entry.notes}</p>}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600 underline"
                      onClick={() => onRemoveRef(entry.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
            {entries.length === 0 && (
              <li className="text-[var(--muted)]">No refs on your roster yet. Open the form above to add one.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
