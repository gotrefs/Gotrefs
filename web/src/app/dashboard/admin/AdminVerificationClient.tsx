"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminTax1099Panel } from "@/components/admin/AdminTax1099Panel";
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
  docs_from_storage?: boolean;
  screening_status: string | null;
  screening_summary: string | null;
  admin_queue_hidden_at: string | null;
};

type QueueFilter = "pending" | "resubmitted" | "all" | "approved" | "rejected" | "incomplete" | "removed";

function isHiddenFromQueue(entry: VerificationEntry) {
  return Boolean(entry.admin_queue_hidden_at);
}

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusLabel(status: string) {
  if (status === "not_submitted") return "Not submitted";
  return status.replace(/_/g, " ");
}

function isPendingStatus(status: string) {
  return ["submitted", "under_review", "draft"].includes(status);
}

function isIncompleteStatus(status: string) {
  return status === "not_submitted" || status === "draft";
}

function isResubmitted(entry: VerificationEntry) {
  return Boolean(entry.resubmitted_at) && isPendingStatus(entry.status);
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
  const [search, setSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [queueActionId, setQueueActionId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!menuOpenId && !confirmRemoveId) return;
    const close = () => {
      setMenuOpenId(null);
      setConfirmRemoveId(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpenId, confirmRemoveId]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => !isHiddenFromQueue(entry)),
    [entries]
  );

  const removedEntries = useMemo(
    () => entries.filter((entry) => isHiddenFromQueue(entry)),
    [entries]
  );

  const counts = useMemo(() => {
    const all = visibleEntries.length;
    const pending = visibleEntries.filter((entry) => isPendingStatus(entry.status)).length;
    const resubmitted = visibleEntries.filter((entry) => isResubmitted(entry)).length;
    const approved = visibleEntries.filter((entry) => entry.status === "approved").length;
    const rejected = visibleEntries.filter((entry) => entry.status === "rejected").length;
    const incomplete = visibleEntries.filter((entry) => isIncompleteStatus(entry.status)).length;
    const removed = removedEntries.length;
    return { all, pending, resubmitted, approved, rejected, incomplete, removed };
  }, [visibleEntries, removedEntries]);

  const filteredEntries = useMemo(() => {
    const source = filter === "removed" ? removedEntries : visibleEntries;
    const needle = search.trim().toLowerCase();
    const byFilter = source.filter((entry) => {
      if (filter === "removed") return true;
      if (filter === "approved") return entry.status === "approved";
      if (filter === "rejected") return entry.status === "rejected";
      if (filter === "pending") return isPendingStatus(entry.status);
      if (filter === "resubmitted") return isResubmitted(entry);
      if (filter === "incomplete") return isIncompleteStatus(entry.status);
      return true;
    });
    if (!needle) return byFilter;
    return byFilter.filter((entry) => {
      const haystack = [
        entry.display_name,
        entry.email,
        entry.first_name,
        entry.last_name,
        entry.primary_sport,
        entry.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [visibleEntries, removedEntries, filter, search]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const entry = entries.find((row) => row.ref_member_id === selectedId) ?? null;
    if (!entry) return null;
    if (filter !== "removed" && isHiddenFromQueue(entry)) return null;
    return entry;
  }, [entries, selectedId, filter]);

  async function setQueueVisibility(
    entry: VerificationEntry,
    action: "remove" | "restore"
  ) {
    setQueueActionId(entry.ref_member_id);
    setMsg(null);
    setMenuOpenId(null);
    setConfirmRemoveId(null);
    try {
      const res = await fetch(`/api/admin/verification/${entry.ref_member_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: string; adminQueueHiddenAt?: string | null };
      if (!res.ok) {
        setMsg(json.error || "Could not update the queue.");
        return;
      }
      const name = entry.display_name || entry.email || "Referee";
      const hiddenAt = action === "remove" ? json.adminQueueHiddenAt ?? new Date().toISOString() : null;
      setEntries((current) =>
        current.map((row) =>
          row.ref_member_id === entry.ref_member_id
            ? { ...row, admin_queue_hidden_at: hiddenAt }
            : row
        )
      );
      if (action === "remove") {
        if (selectedId === entry.ref_member_id) setSelectedId(null);
        setMsg(`Removed ${name} from the queue. Find them under Removed.`);
      } else {
        setMsg(`Restored ${name} to the queue.`);
      }
      void load();
    } catch {
      setMsg("Could not reach the admin verification API.");
    } finally {
      setQueueActionId(null);
    }
  }

  useEffect(() => {
    setAdminNotes(selected?.admin_notes ?? "");
    setFixRequiredSteps(selected?.fix_required_steps ?? []);
    setCompletedActions({});
  }, [selected?.ref_member_id]);

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
    if (action === "request_info" && fixRequiredSteps.length === 0) {
      setMsg("Select at least one signup step (1–5) the referee needs to fix.");
      return;
    }
    if (action === "request_info" && !adminNotes.trim()) {
      setMsg("Add a message explaining what the referee needs to provide.");
      return;
    }
    if (action === "reject" && !adminNotes.trim()) {
      setMsg("Add a reason explaining why this referee is not approved / approval is revoked.");
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
      const json = (await res.json()) as { error?: string; status?: string; emailSent?: boolean };
      if (!res.ok) {
        setMsg(json.error || "Could not update verification.");
        return;
      }
      const name = selected.display_name || selected.email || "referee";
      const wasApproved = selected.status === "approved";
      const emailNote =
        json.emailSent === true
          ? " Email sent."
          : json.emailSent === false
            ? " Warning: email could not be sent — check RESEND_API_KEY / RESEND_FROM_EMAIL."
            : "";
      setMsg(
        (action === "approve"
          ? `✓ ${name} set to approved.`
          : action === "reject"
            ? wasApproved
              ? `✓ Approval revoked for ${name}. They can no longer request games.`
              : `✓ ${name} set to rejected.`
            : `✓ Requested changes from ${name}. Approval paused until they resubmit and you approve again.`) +
          emailNote
      );
      setCompletedActions({ [action]: true });
      // Keep the referee visible after a decision so you can change status again.
      setFilter("all");
      setSelectedId(selected.ref_member_id);
      await load();
    } catch {
      setMsg("Could not reach the admin verification API.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentStatus = selected?.status ?? "";
  const approveMarked = Boolean(completedActions.approve || currentStatus === "approved");
  const rejectMarked = Boolean(completedActions.reject || currentStatus === "rejected");
  const requestInfoMarked = Boolean(
    completedActions.request_info ||
      (currentStatus === "under_review" && (selected?.fix_required_steps.length ?? 0) > 0)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Admin only</p>
        <h1 className="mt-1 font-display text-3xl font-black text-[var(--navy)]">Referee verification review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Every referee account appears here — submitted packages, incomplete signups, approved, and rejected.
          Resubmissions land under <strong>Pending</strong> (and <strong>Resubmitted</strong>) — not Rejected.
          Document buttons use the newest files in storage when available.
        </p>
      </div>

      {msg && (
        <p className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy)]">
          {msg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", "Pending", counts.pending],
              ["resubmitted", "Resubmitted", counts.resubmitted],
              ["all", "All", counts.all],
              ["incomplete", "Not submitted", counts.incomplete],
              ["approved", "Approved", counts.approved],
              ["rejected", "Rejected", counts.rejected],
              ["removed", "Removed", counts.removed],
            ] as const
          ).map(([value, label, count]) => (
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
              {label} ({count})
            </button>
          ))}
        </div>
        <label className="min-w-[14rem] flex-1">
          <span className="sr-only">Search referees</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, sport…"
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-display text-lg font-black text-[var(--navy)]">
              Queue · {filteredEntries.length} shown
              {filter === "removed"
                ? counts.removed !== filteredEntries.length
                  ? ` of ${counts.removed} removed`
                  : ""
                : visibleEntries.length !== filteredEntries.length
                  ? ` of ${visibleEntries.length}`
                  : ""}
            </h2>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">Loading submissions…</p>
          ) : filteredEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--muted)]">No referees in this filter.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filteredEntries.map((entry) => {
                const active = selected?.ref_member_id === entry.ref_member_id;
                const resubmitted = isResubmitted(entry);
                const hidden = isHiddenFromQueue(entry);
                const menuOpen = menuOpenId === entry.ref_member_id;
                const confirmRemove = confirmRemoveId === entry.ref_member_id;
                const queueBusy = queueActionId === entry.ref_member_id;
                const displayName =
                  entry.display_name ||
                  `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() ||
                  "Unnamed referee";
                return (
                  <li key={entry.ref_member_id} className="relative">
                    <div
                      className={`flex items-stretch ${
                        active
                          ? "bg-[var(--blue)]/5"
                          : resubmitted
                            ? "bg-amber-50/80"
                            : hidden
                              ? "bg-slate-50"
                              : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(entry.ref_member_id)}
                        className={`min-w-0 flex-1 px-4 py-4 text-left transition hover:bg-slate-50/80 ${
                          active ? "hover:bg-[var(--blue)]/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-[var(--navy)]">{displayName}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{entry.email}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {entry.primary_sport} · {entry.certification_level}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                              hidden
                                ? "bg-slate-200 text-slate-700"
                                : resubmitted
                                  ? "bg-amber-200 text-amber-950"
                                  : "bg-slate-100 text-[var(--navy)]"
                            }`}
                          >
                            {hidden ? "Removed" : resubmitted ? "Resubmitted" : statusLabel(entry.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {hidden
                            ? `Removed ${formatWhen(entry.admin_queue_hidden_at)}`
                            : entry.resubmitted_at
                              ? `Resubmitted ${formatWhen(entry.resubmitted_at)}`
                              : `Submitted ${formatWhen(entry.submitted_at)}`}
                        </p>
                        {entry.fix_required_steps.length > 0 &&
                          !hidden &&
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
                      <div className="relative flex shrink-0 items-start px-2 py-3">
                        <button
                          type="button"
                          disabled={queueBusy}
                          aria-label={`Actions for ${displayName}`}
                          aria-expanded={menuOpen || confirmRemove}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (confirmRemove) {
                              setConfirmRemoveId(null);
                              setMenuOpenId(null);
                              return;
                            }
                            setConfirmRemoveId(null);
                            setMenuOpenId((current) =>
                              current === entry.ref_member_id ? null : entry.ref_member_id
                            );
                          }}
                          className="rounded-full border border-slate-200 px-3 py-2 text-sm font-black text-[var(--navy)] transition hover:border-[var(--navy)] disabled:opacity-50"
                        >
                          ⋯
                        </button>
                        {(menuOpen || confirmRemove) && (
                          <div
                            className="absolute right-2 top-12 z-20 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {confirmRemove ? (
                              <div className="p-3">
                                <p className="text-xs font-semibold text-[var(--navy)]">
                                  Remove {displayName} from this list?
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                                  Their account stays active. You can restore them from Removed.
                                </p>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={queueBusy}
                                    onClick={() => void setQueueVisibility(entry, "remove")}
                                    className="rounded-full bg-[var(--red)] px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmRemoveId(null);
                                      setMenuOpenId(null);
                                    }}
                                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--navy)]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : hidden ? (
                              <button
                                type="button"
                                disabled={queueBusy}
                                onClick={() => void setQueueVisibility(entry, "restore")}
                                className="block w-full px-4 py-3 text-left text-sm font-bold text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
                              >
                                Restore to queue
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setConfirmRemoveId(entry.ref_member_id);
                                }}
                                className="block w-full px-4 py-3 text-left text-sm font-bold text-[var(--red)] hover:bg-red-50"
                              >
                                Remove…
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
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
                {isHiddenFromQueue(selected) && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm text-[var(--muted)]">
                      Removed from queue {formatWhen(selected.admin_queue_hidden_at)}.
                    </p>
                    <button
                      type="button"
                      disabled={queueActionId === selected.ref_member_id}
                      onClick={() => void setQueueVisibility(selected, "restore")}
                      className="rounded-full border border-[var(--navy)] px-4 py-2 text-sm font-bold text-[var(--navy)] disabled:opacity-60"
                    >
                      Restore to queue
                    </button>
                  </div>
                )}
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
                {selected.resubmitted_at && (
                  <div>
                    <dt className="font-bold text-[var(--navy)]">Resubmitted</dt>
                    <dd className="font-semibold text-amber-800">{formatWhen(selected.resubmitted_at)}</dd>
                  </div>
                )}
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
                  className={`rounded-full border px-4 py-2 text-sm font-bold hover:border-[var(--blue)] ${
                    selected.government_id_path
                      ? "border-[var(--border)] text-[var(--navy)]"
                      : "border-dashed border-slate-300 text-slate-400"
                  }`}
                >
                  View ID front{selected.government_id_path ? "" : " (missing)"}
                </button>
                <button
                  type="button"
                  onClick={() => void openDocument(selected.government_id_back_path, "Government ID back")}
                  className={`rounded-full border px-4 py-2 text-sm font-bold hover:border-[var(--blue)] ${
                    selected.government_id_back_path
                      ? "border-[var(--border)] text-[var(--navy)]"
                      : "border-dashed border-slate-300 text-slate-400"
                  }`}
                >
                  View ID back{selected.government_id_back_path ? "" : " (missing)"}
                </button>
                <button
                  type="button"
                  onClick={() => void openDocument(selected.certification_document_path, "Certification document")}
                  className={`rounded-full border px-4 py-2 text-sm font-bold hover:border-[var(--blue)] ${
                    selected.certification_document_path
                      ? "border-[var(--border)] text-[var(--navy)]"
                      : "border-dashed border-slate-300 text-slate-400"
                  }`}
                >
                  View certification{selected.certification_document_path ? "" : " (missing)"}
                </button>
              </div>
              {selected.docs_from_storage && (
                <p className="mt-2 text-xs font-semibold text-amber-800">
                  Showing newest files from storage (profile paths were missing or out of date).
                </p>
              )}

              <label className="mt-5 block">
                <span className="text-sm font-bold text-[var(--navy)]">What needs to be fixed? (optional for Rejected)</span>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Required for Needs info. For Rejected, select steps only if they should resubmit those items;
                  otherwise a reason alone is enough to revoke approval.
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
                <span className="text-sm font-bold text-[var(--navy)]">Reason / message to referee</span>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={4}
                  placeholder="Required for Rejected or Needs info. Example: Approval revoked — certification expired. Please upload a current credential."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </label>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-[var(--navy)]">Review decision</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--navy)] ring-1 ring-slate-200">
                    Current: {statusLabel(currentStatus || "unknown")}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  <strong>Needs info</strong> pauses approval: they lose game requests until they fix the selected
                  steps, resubmit, and you approve again. <strong>Rejected</strong> also blocks game requests.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("approve")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    approveMarked ? "bg-green-700 ring-2 ring-green-300" : "bg-green-600"
                  }`}
                >
                  {approveMarked ? "✓ Approved" : "Approved"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("request_info")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    requestInfoMarked ? "bg-[var(--navy)] ring-2 ring-slate-300" : "bg-[var(--blue)]"
                  }`}
                >
                  {requestInfoMarked ? "✓ Needs info" : "Needs info"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review("reject")}
                  className={`rounded-full px-5 py-2.5 text-sm font-black text-white disabled:opacity-60 ${
                    rejectMarked ? "bg-[var(--red-dark)] ring-2 ring-red-300" : "bg-[var(--red)]"
                  }`}
                >
                  {rejectMarked ? "✓ Rejected" : "Rejected"}
                </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a referee from the queue to review their submission.</p>
          )}
        </section>
      </div>

      <AdminTax1099Panel />
    </div>
  );
}
