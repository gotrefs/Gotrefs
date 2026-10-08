"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminSignupEntry } from "@/lib/admin/signups";
import AdminSignupUploadsModal from "./AdminSignupUploadsModal";

type RoleFilter = "all" | "ref" | "organizer";
const PREVIEW_ROWS = 15;

const ROLE_LABEL: Record<AdminSignupEntry["role"], string> = {
  ref: "REFeree",
  organizer: "Organizer",
  unknown: "Not set",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Quote a CSV cell; neutralize cells a spreadsheet would run as a formula. */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: AdminSignupEntry[]) {
  const header = ["First name", "Last name", "Email", "Phone", "Type", "Sport", "Organization", "GotREFS ID", "Signed up", "Email confirmed"];
  const lines = rows.map((row) =>
    [
      row.firstName || row.name,
      row.lastName,
      row.email,
      row.phone,
      ROLE_LABEL[row.role],
      row.sport,
      row.organization,
      row.gotrefsId,
      row.signedUpAt ? row.signedUpAt.slice(0, 10) : "",
      row.emailConfirmed ? "Yes" : "No",
    ]
      .map((cell) => csvCell(cell ?? ""))
      .join(",")
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}

/** Admin: every real account that has signed up, with name and email. */
export default function AdminSignupsPanel() {
  const [signups, setSignups] = useState<AdminSignupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [viewing, setViewing] = useState<AdminSignupEntry | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/signups", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { signups?: AdminSignupEntry[]; error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load signups.");
        return json.signups ?? [];
      })
      .then((rows) => {
        if (cancelled) return;
        setSignups(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load signups.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  // Coming back to this tab (say, after deleting someone in Supabase) reloads the list.
  useEffect(() => {
    const onFocus = () => setReloadKey((key) => key + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const counts = useMemo(
    () => ({
      all: signups.length,
      ref: signups.filter((s) => s.role === "ref").length,
      organizer: signups.filter((s) => s.role === "organizer").length,
    }),
    [signups]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return signups.filter((s) => {
      if (role !== "all" && s.role !== role) return false;
      if (!needle) return true;
      return [s.name, s.email, s.phone, s.sport, s.organization, s.gotrefsId].join(" ").toLowerCase().includes(needle);
    });
  }, [signups, role, search]);

  const visible = showAll ? filtered : filtered.slice(0, PREVIEW_ROWS);

  function downloadCsv() {
    const blob = new Blob([`﻿${toCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gotrefs-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mb-10 rounded-2xl border border-[var(--border)] bg-white shadow-sm" aria-label="Signups">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--red)]">Admin only</p>
          <h1 className="mt-1 font-display text-3xl font-black text-[var(--navy)]">Signups</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Everyone who has created an account, newest first. Sample profiles are not included.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--navy)] hover:border-[var(--navy)] disabled:opacity-60"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={filtered.length === 0}
            className="rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All", counts.all],
              ["ref", "REFerees", counts.ref],
              ["organizer", "Organizers", counts.organizer],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              aria-pressed={role === value}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                role === value
                  ? "bg-[var(--navy)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--navy)] hover:border-[var(--navy)]"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <label className="min-w-[14rem] flex-1">
          <span className="sr-only">Search signups</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
          />
        </label>
      </div>

      {error ? (
        <p className="px-4 pb-5 text-sm font-semibold text-red-700 sm:px-5">{error}</p>
      ) : loading && signups.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-[var(--muted)] sm:px-5">Loading signups…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-[var(--muted)] sm:px-5">
          {signups.length === 0 ? "No one has signed up yet." : "No signups match that search."}
        </p>
      ) : (
        <>
          {/* Phones: one card per person. */}
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)] sm:hidden">
            {visible.map((s) => (
              <li key={s.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-[var(--navy)]">{s.name || "No name given"}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    {ROLE_LABEL[s.role]}
                  </span>
                </div>
                <p className="mt-0.5 break-all text-slate-700">{s.email || "No email"}</p>
                {s.phone ? <p className="text-slate-700">{s.phone}</p> : null}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {[s.sport || s.organization, `Signed up ${formatDate(s.signedUpAt)}`, s.emailConfirmed ? null : "Email not confirmed"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <button
                  type="button"
                  onClick={() => setViewing(s)}
                  className="mt-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] hover:border-[var(--navy)]"
                >
                  Uploaded info
                </button>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto border-t border-[var(--border)] sm:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Name</th>
                  <th scope="col" className="px-3 py-2.5">Email</th>
                  <th scope="col" className="px-3 py-2.5">Phone</th>
                  <th scope="col" className="px-3 py-2.5">Type</th>
                  <th scope="col" className="px-3 py-2.5">Sport / organization</th>
                  <th scope="col" className="px-3 py-2.5">Signed up</th>
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">Uploaded info</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-2.5 font-semibold text-[var(--navy)]">{s.name || "No name given"}</td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {s.email || "—"}
                      {!s.emailConfirmed && s.email ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          Not confirmed
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{s.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-700">{ROLE_LABEL[s.role]}</td>
                    <td className="px-3 py-2.5 text-slate-700">{s.sport || s.organization || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatDate(s.signedUpAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setViewing(s)}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--navy)] hover:border-[var(--navy)]"
                      >
                        Uploaded info
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > PREVIEW_ROWS ? (
            <div className="border-t border-[var(--border)] px-4 py-3 text-center sm:px-5">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-sm font-bold text-[var(--navy)] underline"
              >
                {showAll ? `Show the newest ${PREVIEW_ROWS}` : `Show all ${filtered.length}`}
              </button>
            </div>
          ) : null}
        </>
      )}
      {viewing ? (
        <AdminSignupUploadsModal
          key={viewing.id}
          memberId={viewing.id}
          fallbackName={viewing.name}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </section>
  );
}
