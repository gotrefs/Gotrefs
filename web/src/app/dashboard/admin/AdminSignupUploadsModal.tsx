"use client";

import { useEffect, useState } from "react";
import { RefereeIdCard } from "@/components/RefereeIdCard";
import type { SignupUploadFile, SignupUploads } from "@/lib/admin/signup-uploads";

const STATUS_LABEL: Record<string, string> = {
  approved: "Verified",
  submitted: "Submitted for review",
  under_review: "Under review",
  rejected: "Not approved",
  draft: "Not submitted",
};

function formatWhen(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function FileTile({ file }: { file: SignupUploadFile }) {
  const when = formatWhen(file.uploadedAt);
  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      {file.url && file.isImage ? (
        <a href={file.url} target="_blank" rel="noreferrer noopener" className="block bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.url}
            alt={file.label}
            referrerPolicy="no-referrer"
            className="h-44 w-full object-contain"
          />
        </a>
      ) : (
        <div className="flex h-44 items-center justify-center bg-slate-100 px-3 text-center text-sm text-slate-500">
          {file.url ? "Document (opens in a new tab)" : "This file could not be opened."}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-[var(--navy)]">{file.label}</p>
          <p className="truncate text-xs text-[var(--muted)]">{when ? `Uploaded ${when}` : file.name}</p>
        </div>
        {file.url ? (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] hover:border-[var(--navy)]"
          >
            Open
          </a>
        ) : null}
      </div>
    </li>
  );
}

/** Admin: everything one person uploaded — their card, ID, certification and any other files. */
export default function AdminSignupUploadsModal({
  memberId,
  fallbackName,
  onClose,
}: {
  memberId: string;
  fallbackName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<SignupUploads | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/signups/${encodeURIComponent(memberId)}/uploads`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as SignupUploads & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load uploaded info.");
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load uploaded info.");
      });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const person = data?.person;
  const documents = (data?.files ?? []).filter((file) => file.kind !== "photo");
  const photos = (data?.files ?? []).filter((file) => file.kind === "photo");
  const verified = person?.verificationStatus === "approved";

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/55 p-4">
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="uploaded-info-title"
        className="relative mx-auto my-6 w-full max-w-4xl rounded-3xl bg-[#f8fafb] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Uploaded info</p>
            <h2 id="uploaded-info-title" className="mt-1 truncate font-display text-2xl font-black text-[var(--navy)]">
              {person?.name || fallbackName || "No name given"}
            </h2>
            {person ? (
              <p className="mt-1 break-all text-sm text-slate-700">
                {[person.email, person.phone].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] hover:border-[var(--navy)]"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {error ? (
            <p className="text-sm font-semibold text-red-700">{error}</p>
          ) : !data || !person ? (
            <p className="text-sm text-[var(--muted)]">Loading uploaded info…</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
              <section aria-label={person.role === "ref" ? "Ref card" : "Profile"}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {person.role === "ref" ? "Ref card" : "Profile"}
                </h3>
                {person.role === "ref" ? (
                  <div className="mt-2">
                    <RefereeIdCard
                      fullName={person.name}
                      gotrefsId={person.gotrefsId || undefined}
                      primarySport={person.sport || undefined}
                      additionalSports={person.additionalSports}
                      certificationLevel={person.certificationLevel || undefined}
                      avatarUrl={person.photoUrl ?? undefined}
                      avatarLabel="REF"
                      verificationStatus={person.verificationStatus}
                      verified={verified}
                      emptyPlaceholders
                      hideQr={!person.gotrefsId}
                      className="w-full"
                    />
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Status:{" "}
                      <span className="font-bold text-[var(--navy)]">
                        {person.verificationStatus
                          ? (STATUS_LABEL[person.verificationStatus] ?? person.verificationStatus.replace(/_/g, " "))
                          : "Nothing submitted for verification"}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-white p-4 text-sm">
                    {person.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.photoUrl}
                        alt="Logo or photo"
                        referrerPolicy="no-referrer"
                        className="mb-3 h-24 w-24 rounded-xl object-cover"
                      />
                    ) : null}
                    <p className="font-bold text-[var(--navy)]">{person.organization || person.name || "No name given"}</p>
                    <p className="mt-1 text-slate-700">
                      {person.role === "organizer" ? "Organizer" : "Account type not set"}
                    </p>
                  </div>
                )}
              </section>

              <section aria-label="Uploaded files">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">ID and documents</h3>
                {documents.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
                    {person.role === "ref"
                      ? "No government ID or certification uploaded yet."
                      : "No documents uploaded."}
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {documents.map((file) => (
                      <FileTile key={`${file.kind}-${file.name}`} file={file} />
                    ))}
                  </ul>
                )}

                {photos.length > 0 ? (
                  <>
                    <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {photos.length === 1 ? "Photo" : "Photos"}
                    </h3>
                    <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                      {photos.map((file) => (
                        <FileTile key={`${file.kind}-${file.name}`} file={file} />
                      ))}
                    </ul>
                  </>
                ) : null}
                <p className="mt-4 text-xs text-[var(--muted)]">
                  File links are private and stop working after 15 minutes. Reopen this window for fresh ones.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
