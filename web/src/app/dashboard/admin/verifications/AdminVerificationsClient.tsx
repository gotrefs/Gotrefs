"use client";

import { useCallback, useEffect, useState } from "react";

type QueueItem = {
  refMemberId: string;
  status: string;
  submittedAt: string | null;
  reviewVersion: number;
  displayName: string;
  emailMasked: string | null;
  primarySport: string | null;
  certificationLevel: string | null;
};

type DetailResponse = {
  refMemberId: string;
  displayName: string;
  email: string | null;
  profile: {
    primarySport: string | null;
    additionalSports: string[];
    certificationLevel: string | null;
    bio: string | null;
    verificationMethod: string | null;
    externalVerifierName: string | null;
  };
  submission: {
    status: string;
    submitted_at?: string | null;
    review_version?: number;
    rejection_reason?: string | null;
  };
  screening: { status: string; summary: string | null; provider: string } | null;
  documents: {
    governmentIdUrl: string | null;
    certificationUrl: string | null;
    externalProofUrl: string | null;
  };
  nsidReviewUrl: string | null;
};

const REJECTION_PRESETS = [
  "ID unreadable or expired",
  "Certification document missing or invalid",
  "Name mismatch between ID and profile",
  "Other",
] as const;

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function DocumentPreview({ title, url }: { title: string; url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-4 text-sm text-[var(--muted)]">
        {title}: not uploaded
      </div>
    );
  }

  const isPdf = url.toLowerCase().includes(".pdf") || url.includes("application%2Fpdf");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{title}</p>
      {isPdf ? (
        <iframe title={title} src={url} className="mt-2 h-72 w-full rounded-lg border border-[var(--border)]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="mt-2 max-h-72 w-full rounded-lg border border-[var(--border)] object-contain" />
      )}
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[var(--blue)]">
        Open in new tab
      </a>
    </div>
  );
}

export default function AdminVerificationsClient() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectPreset, setRejectPreset] = useState<string>(REJECTION_PRESETS[0]);
  const [rejectCustom, setRejectCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verifications");
      const json = (await res.json()) as { items?: QueueItem[]; error?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Could not load verification queue.");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
      if ((json.items ?? []).length > 0 && !selectedId) {
        setSelectedId(json.items![0].refMemberId);
      }
    } catch {
      setMsg("Network error loading verification queue.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (refId: string) => {
    setDetailLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/verifications/${refId}`);
      const json = (await res.json()) as DetailResponse & { error?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Could not load verification detail.");
        setDetail(null);
        return;
      }
      setDetail(json);
    } catch {
      setMsg("Network error loading verification detail.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function review(action: "approve" | "reject", reason?: string) {
    if (!selectedId) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/verifications/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Review action failed.");
        return;
      }
      setShowRejectModal(false);
      setRejectCustom("");
      setRejectPreset(REJECTION_PRESETS[0]);
      setMsg(action === "approve" ? "Referee approved." : "Referee denied.");
      await loadQueue();
      const next = items.find((item) => item.refMemberId !== selectedId);
      setSelectedId(next?.refMemberId ?? null);
      setDetail(null);
    } catch {
      setMsg("Network error submitting review.");
    } finally {
      setSubmitting(false);
    }
  }

  const rejectReason =
    rejectPreset === "Other" ? rejectCustom.trim() : rejectPreset;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--red)]">Platform admin</p>
        <h1 className="mt-1 font-display text-3xl font-black text-[var(--navy)]">Verification review queue</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--slate)]">
          Review referee government IDs and certification documents. Approved refs can apply to posted events.
        </p>
      </div>

      {msg && (
        <p className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[var(--navy)]">
          {msg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-[var(--navy)]">Pending ({items.length})</h2>
            <button
              type="button"
              onClick={() => void loadQueue()}
              className="text-sm font-semibold text-[var(--blue)]"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading queue…</p>
          ) : items.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">No submissions awaiting review.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {items.map((item) => (
                <li key={item.refMemberId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.refMemberId)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedId === item.refMemberId
                        ? "border-[var(--blue)] bg-[var(--blue)]/5"
                        : "border-[var(--border)] hover:border-[var(--blue)]/40"
                    }`}
                  >
                    <p className="font-bold text-[var(--navy)]">{item.displayName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {item.primarySport ?? "Sport TBD"} · {item.certificationLevel ?? "Cert TBD"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Submitted {formatWhen(item.submittedAt)} · v{item.reviewVersion}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          {!selectedId ? (
            <p className="text-sm text-[var(--muted)]">Select a referee from the queue.</p>
          ) : detailLoading ? (
            <p className="text-sm text-[var(--muted)]">Loading documents…</p>
          ) : detail ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-[var(--navy)]">{detail.displayName}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{detail.email ?? "Email hidden"}</p>
                  <p className="mt-1 text-sm capitalize text-[var(--slate)]">
                    Status: {detail.submission.status.replace(/_/g, " ")} · v
                    {detail.submission.review_version ?? 1}
                  </p>
                </div>
                {detail.nsidReviewUrl && (
                  <a
                    href={detail.nsidReviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--blue)]"
                  >
                    Review in NSID
                  </a>
                )}
              </div>

              <div className="rounded-xl bg-[var(--grey-light)]/60 p-4 text-sm text-[var(--slate)]">
                <p>
                  <span className="font-semibold text-[var(--navy)]">Sport:</span>{" "}
                  {detail.profile.primarySport ?? "—"}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[var(--navy)]">Certification:</span>{" "}
                  {detail.profile.certificationLevel ?? "—"}
                </p>
                {detail.profile.bio && (
                  <p className="mt-2 whitespace-pre-wrap">
                    <span className="font-semibold text-[var(--navy)]">Bio:</span> {detail.profile.bio}
                  </p>
                )}
                {detail.profile.verificationMethod === "external" && detail.profile.externalVerifierName && (
                  <p className="mt-2">
                    <span className="font-semibold text-[var(--navy)]">External verifier:</span>{" "}
                    {detail.profile.externalVerifierName}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DocumentPreview title="Government ID" url={detail.documents.governmentIdUrl} />
                <DocumentPreview title="Certification" url={detail.documents.certificationUrl} />
              </div>
              {detail.documents.externalProofUrl && (
                <DocumentPreview title="External verification proof" url={detail.documents.externalProofUrl} />
              )}

              {["submitted", "under_review"].includes(detail.submission.status) && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void review("approve")}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowRejectModal(true)}
                    className="rounded-xl bg-[var(--red)] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Could not load this referee.</p>
          )}
        </section>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-[var(--navy)]">Deny verification</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              The referee will see this reason and must fix the issue before resubmitting.
            </p>
            <label className="mt-4 block text-sm font-semibold text-[var(--navy)]">
              Reason
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                value={rejectPreset}
                onChange={(e) => setRejectPreset(e.target.value)}
              >
                {REJECTION_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>
            {rejectPreset === "Other" && (
              <label className="mt-3 block text-sm font-semibold text-[var(--navy)]">
                Details
                <textarea
                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2"
                  rows={3}
                  value={rejectCustom}
                  onChange={(e) => setRejectCustom(e.target.value)}
                  placeholder="Explain what the referee needs to fix"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || (rejectPreset === "Other" && !rejectCustom.trim())}
                onClick={() => void review("reject", rejectReason)}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                Confirm deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
