"use client";

import { useEffect, useMemo, useState } from "react";
import { AssignorRosterPanel, type AssignorRosterEntry } from "@/components/AssignorRosterPanel";
import { createClient } from "@/lib/supabase/client";

type ImportResponse = {
  error?: string;
  imported?: number;
  entries?: AssignorRosterEntry[];
};

export default function AssignorDashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<AssignorRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignorSaving, setAssignorSaving] = useState(false);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeChoice, setActiveChoice] = useState<"manual" | "upload">("manual");
  const [msg, setMsg] = useState<string | null>(null);

  async function loadRoster() {
    const res = await fetch("/api/assignor/roster");
    const json = (await res.json()) as { entries?: AssignorRosterEntry[]; error?: string };
    if (!res.ok) {
      setMsg(json.error || "Could not load your roster.");
      return;
    }
    setEntries(json.entries ?? []);
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      setMsg(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      await fetch("/api/assignor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_assignor: true }),
      });
      if (mounted) await loadRoster();
      if (mounted) setLoading(false);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function toggleAssignor(enabled: boolean) {
    setAssignorSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_assignor: enabled }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not update assignor mode.");
        return;
      }
      setMsg(enabled ? "Assignor mode enabled." : "Assignor mode turned off.");
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setAssignorSaving(false);
    }
  }

  async function addRef(payload: {
    display_name: string;
    contact_email?: string | null;
    primary_sport: string;
    additional_sports: string[];
    certification_level: string;
    rate_per_game: number | null;
    availability: { start_at: string; end_at: string }[];
    notes: string;
  }) {
    setRosterSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assignor/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; entry?: AssignorRosterEntry };
      if (!res.ok) {
        setMsg(json.error || "Could not save ref.");
        return;
      }
      if (json.entry) setEntries((current) => [json.entry!, ...current]);
      setMsg("Ref saved to your assignor roster.");
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setRosterSaving(false);
    }
  }

  async function removeRef(id: string) {
    const previous = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    const res = await fetch(`/api/assignor/roster?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setEntries(previous);
      setMsg("Could not remove that ref.");
      return;
    }
    setMsg("Removed from roster.");
  }

  async function importFile(file: File) {
    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/assignor/roster/import", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as ImportResponse;
      if (!res.ok) {
        setMsg(json.error || "Could not import that file.");
        return;
      }
      setEntries((current) => [...(json.entries ?? []), ...current]);
      setMsg(`Imported ${json.imported ?? 0} ref${json.imported === 1 ? "" : "s"} into your roster.`);
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] bg-[var(--navy)] p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--red)]">Assignor workspace</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Add your refs once. Staff games faster later.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80">
            Choose the cleanest path for today: manually add a ref, or upload a roster file and let GotREFS store each
            ref in Supabase.
          </p>
        </section>

        {msg && (
          <p className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)] shadow-sm">
            {msg}
          </p>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setActiveChoice("manual")}
            className={`rounded-3xl border p-6 text-left shadow-sm transition ${
              activeChoice === "manual" ? "border-[var(--navy)] bg-white" : "border-slate-200 bg-white/70 hover:bg-white"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Option A</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--navy)]">Manually input ref info</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Best for adding one ref or a small crew with details you already know.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveChoice("upload")}
            className={`rounded-3xl border p-6 text-left shadow-sm transition ${
              activeChoice === "upload" ? "border-[var(--navy)] bg-white" : "border-slate-200 bg-white/70 hover:bg-white"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Option B</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--navy)]">Upload a ref list</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Upload a CSV or text file with names, emails, sports, certifications, rates, and notes.
            </p>
          </button>
        </section>

        <section className="mt-6">
          {activeChoice === "manual" ? (
            <AssignorRosterPanel
              isAssignor
              assignorSaving={assignorSaving}
              entries={entries}
              rosterSaving={rosterSaving}
              onToggleAssignor={toggleAssignor}
              onAddRef={addRef}
              onRemoveRef={removeRef}
              showModeToggle={false}
            />
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-2xl font-black text-[var(--navy)]">Upload roster file</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Recommended columns: name, email, sport, certification, rate, notes. A plain list also works, one ref
                per line.
              </p>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition hover:border-[var(--navy)] hover:bg-white">
                <span className="text-sm font-black text-[var(--navy)]">
                  {uploading ? "Importing..." : "Choose CSV or text file"}
                </span>
                <span className="mt-2 text-xs text-[var(--muted)]">GotREFS will create roster rows automatically.</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  disabled={uploading}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void importFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <p className="font-black">Next automation step</p>
                <p className="mt-1">
                  For messy PDFs or spreadsheets, send the file to an LLM parser, normalize the refs into this same
                  roster format, create draft claim profiles, then email each ref: “Your GotREFS profile was created by
                  [assignor name]. Please fill in the missing information to receive future game notifications.”
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl font-black text-[var(--navy)]">Current roster</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {loading ? "Loading roster..." : `${entries.length} ref${entries.length === 1 ? "" : "s"} stored.`}
          </p>
        </section>
      </div>
    </main>
  );
}
