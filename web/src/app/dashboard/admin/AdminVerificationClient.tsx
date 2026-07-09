"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REF_VERIFICATION_STEPS,
  type RefVerificationStepKey,
} from "@/lib/ref-verification-steps";

type VerificationEntry = {
  ref_member_id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  resubmitted_at: string | null;
  admin_notes: string | null;
  fix_required_steps: RefVerificationStepKey[];
  display_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  primary_sport: string | null;
  additional_sports: string[] | null;
  certification_level: string | null;
  government_id_path: string | null;
  government_id_back_path: string | null;
  certification_document_path: string | null;
  screening_status: string | null;
  screening_summary: string | null;
};

type QueueFilter = "pending" | "all" | "approved" | "rejected";

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function AdminVerificationClient() {
  const [entries, setEntries] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [fixRequiredSteps, setFixRequiredSteps] = useState<RefVerificationStepKey[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedActions, setCompletedActions] = useState<
    Partial<Record<"approve" | "reject" | "request_info", boolean>>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/verification/queue");
      const json = (await res.json()) as { entries?: VerificationEntry[]; error?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not load verification queue.");
        setEntries([]);
        return;
      }
      setEntries(json.entries ?? []);
    } catch {
      setMsg("Could not reach the admin verification API.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEntries = useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "approved") return entries.filter((entry) => entry.status === "approved");
    if (filter === "rejected") return entries.filter((entry) => entry.status === "rejected");
    return entries.filter((entry) => ["submitted", "under_review", "draft"].includes(entry.status));
  }, [entries, filter]);

  const selected = useMemo(
    () => filteredEntries.find((entry) => entry.ref_member_id === selectedId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedId]
  );

  useEffect(() => {
    setAdminNotes(selected?.admin_notes ?? "");
    setFixRequiredSteps(selected?.fix_required_steps ?? []);
    setCompletedActions({});
  }, [selected]);

  function toggleFixStep(key: RefVerificationStepKey) {
    setFixRequiredSteps((current) => {
      const next = current.includes(key) ? current.filter((step) => step !== key) : [...current, key];
      return REF_VERIFICATION_STEPS.map((step) => step.key).filter((stepKey) => next.includes(stepKey));
    });
  }

  async function openDocument(path: string | null, label: string) {
    if (!path) {
      setMsg(`${label} is not on file yet.`);
      return;
    }
    setMsg(null);
    const res = await fetch(`/api/admin/verification/document?path=${encodeURIComponent(path)}`);
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setMsg(json.error || `Could not open ${label.toLowerCase()}.`);
      return;
    }
    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  async function review(action: "approve" | "reject" | "request_info") {
    if (!selected) return;
    if ((action === "request_info" || action === "reject") && fixRequiredSteps.length === 0) {
      setMsg("Select at least one signup step (1–5) the referee needs to fix.");
      return;
    }
    if (action === "request_info" && !adminNotes.trim()) {
      setMsg("Add a message explaining what the referee needs to provide.");
      return;
    }
    if (action === "reject" && !adminNotes.trim()) {
      setMsg("Add a message explaining what the referee needs to change.");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/verification/${selected.ref_member_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminNotes: adminNotes.trim() || undefined,
          fixRequiredSteps: action === "approve" ? undefined : fixRequiredSteps,
        }),
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setMsg(json.error || "Could not update verification.");
        return;
      }
      setMsg(
        action === "approve"
          ? `✓ Approved ${selected.display_name || selected.email || "referee"}.`
          : action === "reject"
            ? `✓ Rejected ${selected.display_name || selected.email || "referee"}.`
            : "Request sent to the referee inbox."
      );
      setCompletedActions((current) => ({ ...current, [action]: true }));
      await load();
    } catch {
      setMsg("Could not reach the admin verification API.");
    } finally {
      setSubmitting(false);
    }
  }

  const approveMarked = Boolean(completedActions.approve || selected?.status === "approved");
  const rejectMarked = Boolean(completedActions.reject || selected?.status === "rejected");
  const requestInfoMarked = Boolean(completedActions.request_info || selected?.status === "under_review");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Admin only</p>
        <h1 className="mt-1 font-display text-3xl font-black text-[var(--navy)]">Referee verification review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Review submitted IDs and certifications, approve verified refs, or send requests that appear in their
          notification inbox.
        </p>
      </div>

      {msg && (
        <p className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)]">
          {msg}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          ["pending", "Pending"],
          ["all", "All"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter === value
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--border)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-display text-lg font-black text-[var(--navy)]">Queue</h2>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">Loading submissions…</p>
          ) : filteredEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">No submissions in this filter.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filteredEntries.map((entry) => {
                const active = selected?.ref_member_id === entry.ref_member_id;
                return (
                  <li key={entry.ref_member_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(entry.ref_member_id)}
                      className={`w-full px-4 py-4 text-left transition ${
                        active ? "bg-[var(--blue)]/5" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-[var(--navy)]">
                            {entry.display_name ||
                              `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() ||
                              "Unnamed referee"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{entry.email}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {entry.primary_sport} · {entry.certification_level}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--navy)]">
                          {entry.resubmitted_at && entry.status === "submitted" ? "Resubmitted" : statusLabel(entry.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {entry.resubmitted_at
                          ? `Resubmitted ${formatWhen(entry.resubmitted_at)}`
                          : `Submitted ${formatWhen(entry.submitted_at)}`}
                      </p>
                      {entry.fix_required_steps.length > 0 &&
                        ["rejected", "under_review"].includes(entry.status) && (
                          <p className="mt-1 text-xs font-semibold text-amber-700">
                            Waiting on steps:{" "}
                            {entry.fix_required_steps
                              .map((key) => REF_VERIFICATION_STEPS.find((step) => step.key === key)?.number)
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          {selected ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--red)]">Selected referee</p>
                <h2 className="mt-1 font-display text-2xl font-black text-[var(--navy)]">
                  {selected.display_name ||
                    `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim() ||
                    "Unnamed referee"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.email}</p>
              </div>

              <dl className="mt-5 grid gap-3 text-sm">
                <div>
                  <dt className="font-bold text-[var(--navy)]">Primary sport</dt>
                  <dd className="text-[var(--muted)]">{selected.primary_sport || "—"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--navy)]">Certification level</dt>
                  <dd className="text-[var(--muted)]">{selected.certification_level || "—"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--navy)]">Additional sports</dt>
                  <dd className="text-[var(--muted)]">
                    {selected.additional_sports?.length ? selected.additional_sports.join(", ") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--navy)]">Submitted</dt>
                  <dd className="text-[var(--muted)]">{formatWhen(selected.submitted_at)}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--navy)]">Screening</dt>
                  <dd className="text-[var(--muted)]">
                    {selected.screening_status || "—"}
                    {selected.screening_summary ? ` · ${selected.screening_summary}` : ""}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openDocument(selected.government_id_path, "Government ID front")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--navy)] hover:border-[var(--blue)]"
                >
                  View ID front
                </button>
                <button
                  type="button"
                  onClick={() => void openDocument(selected.government_id_back_path, "Government ID back")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--navy)] hover:border-[var(--blue)]"
                >
                  View ID back
                </button>
                <button
                  type="button"
                  onClick={() => void openDocument(selected.certification_document_path, "Certification document")}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--navy)] hover:border-[var(--blue)]"
                >
                  View certification
                </button>
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-bold text-[var(--navy)]">What needs to be fixed? (select one or more)</span>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  These match the ref signup steps. Only the numbers you select will appear when they resubmit.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {REF_VERIFICATION_STEPS.map((step) => {
                    const checked = fixRequiredSteps.includes(step.key);
                    return (
                      <label
                        key={step.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                          checked
                            ? "border-[var(--navy)] bg-[var(--navy)]/5"
                            : "border-slate-200 bg-slate-50 hover:border-[var(--blue)]/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleFixStep(step.key)}
                        />
                        <span>
                          <span className="block text-sm font-black text-[var(--navy)]">
                            {step.number}. {step.shortLabel}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">{step.label}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-bold text-[var(--navy)]">Message to referee</span>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={4}
                  placeholder="Example: Please upload a clearer photo of your certification."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("approve")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    approveMarked ? "bg-green-700 ring-2 ring-green-300" : "bg-green-600"
                  }`}
                >
                  {approveMarked ? "✓ Approved" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("request_info")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    requestInfoMarked ? "bg-[var(--navy)] ring-2 ring-slate-300" : "bg-[var(--blue)]"
                  }`}
                >
                  {requestInfoMarked ? "✓ Request sent" : "Request info"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("reject")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    rejectMarked ? "bg-[var(--red-dark)] ring-2 ring-red-300" : "bg-[var(--red)]"
                  }`}
                >
                  {rejectMarked ? "✓ Rejected" : "Reject"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a referee from the queue to review their submission.</p>
          )}
        </section>
      </div>
    </div>
  );
}
