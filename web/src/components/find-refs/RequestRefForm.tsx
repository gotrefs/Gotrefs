"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicRefListing } from "@/lib/marketplace/public-refs";
import { sportEmoji } from "@/lib/sport-emoji";

type Draft = {
  title: string;
  sport: string;
  date: string;
  start: string;
  end: string;
  zip: string;
  city: string;
  pay: string;
  notes: string;
};

const DRAFT_KEY = "gotrefs_ref_request_draft";

function loadDraft(gotrefsId: string): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { gotrefsId: string; draft: Draft };
    return parsed.gotrefsId === gotrefsId ? parsed.draft : null;
  } catch {
    return null;
  }
}

function saveDraft(gotrefsId: string, draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ gotrefsId, draft }));
  } catch {
    // Storage unavailable (private mode): the form just won't be restored.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none focus:border-neutral-900";

export function RequestRefForm({
  listing: r,
  viewerRole,
}: {
  listing: PublicRefListing;
  viewerRole: "organizer" | "ref" | null;
}) {
  const unitLabel = r.rateUnit === "game" ? "game" : "hour";
  const [draft, setDraft] = useState<Draft>({
    title: "",
    sport: r.primarySport,
    date: "",
    start: "",
    end: "",
    zip: "",
    city: "",
    pay: r.rateMin != null ? String(r.rateMin) : "",
    notes: "",
  });
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Bring back what the organizer typed before they created an account.
  useEffect(() => {
    const saved = loadDraft(r.gotrefsId);
    if (saved) {
      // localStorage only exists after hydration, so restoring has to happen in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(saved);
      setRestored(true);
    }
  }, [r.gotrefsId]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const payNum = Number(draft.pay);
  const payTooLow = r.rateMin != null && draft.pay !== "" && Number.isFinite(payNum) && payNum < r.rateMin;
  const hours = useMemo(() => {
    if (!draft.start || !draft.end) return null;
    const [sh, sm] = draft.start.split(":").map(Number);
    const [eh, em] = draft.end.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : null;
  }, [draft.start, draft.end]);
  const estimate =
    Number.isFinite(payNum) && payNum > 0
      ? r.rateUnit === "hour" && hours
        ? payNum * hours
        : r.rateUnit === "game"
          ? payNum
          : null
      : null;

  function validate(): string | null {
    if (!draft.date || !draft.start) return "Add the game date and start time.";
    if (!/^\d{5}$/.test(draft.zip.trim())) return "Add the 5-digit ZIP code where the game is.";
    if (!draft.pay || !Number.isFinite(payNum) || payNum <= 0) return "Add what you'll pay.";
    if (payTooLow) return `${r.name.split(" ")[0]}'s minimum is $${r.rateMin}/${unitLabel}.`;
    return null;
  }

  const returnPath = `/find-refs/request/${encodeURIComponent(r.gotrefsId)}`;

  function continueToAccount(kind: "signup" | "login") {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    saveDraft(r.gotrefsId, draft);
    const next = encodeURIComponent(returnPath);
    window.location.assign(
      kind === "signup" ? `/auth/signup?role=organizer&next=${next}` : `/auth/login?next=${next}`
    );
  }

  async function sendRequest() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const startsAt = new Date(`${draft.date}T${draft.start}`);
      const endsAt = draft.end ? new Date(`${draft.date}T${draft.end}`) : new Date(startsAt.getTime() + 2 * 3600 * 1000);
      const eventRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim() || `${draft.sport} game`,
          sport: draft.sport,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          zip_code: draft.zip.trim(),
          city: draft.city.trim() || null,
          officials_needed: 1,
          pay_type: "exact",
          pay_offer: payNum,
          notes: draft.notes.trim() || null,
        }),
      });
      const eventJson = (await eventRes.json()) as { id?: string; error?: string };
      if (!eventRes.ok || !eventJson.id) throw new Error(eventJson.error || "Could not create your game.");

      const offerRes = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: eventJson.id, refMemberId: r.id, offeredPay: payNum }),
      });
      const offerJson = (await offerRes.json()) as { error?: string };
      if (!offerRes.ok) throw new Error(offerJson.error || "Could not send the request.");

      clearDraft();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-4xl" aria-hidden>
          ✓
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">Request sent to {r.name}</h1>
        <p className="mt-2 text-neutral-600">
          We&apos;ll email you when they accept. You only pay once a ref confirms.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard/organizer" className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
            Go to my dashboard
          </Link>
          <Link href="/find-refs" className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900">
            Request another ref
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/find-refs" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">
        ← Back to refs
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">Request a referee</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Game details */}
        <section>
          {restored && (
            <p className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Welcome back — your game details are saved. Review them and send your request.
            </p>
          )}
          <h2 className="text-xl font-semibold text-neutral-900">Your game</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Event name" hint="Optional — e.g. Saturday U12 league">
                <input value={draft.title} onChange={set("title")} className={inputClass} placeholder={`${draft.sport} game`} />
              </Field>
            </div>
            <Field label="Sport">
              <select value={draft.sport} onChange={set("sport")} className={inputClass}>
                {r.sports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={draft.date} onChange={set("date")} className={inputClass} />
            </Field>
            <Field label="Start time">
              <input type="time" value={draft.start} onChange={set("start")} className={inputClass} />
            </Field>
            <Field label="End time">
              <input type="time" value={draft.end} onChange={set("end")} className={inputClass} />
            </Field>
            <Field label="ZIP code" hint="The ref sees the exact address only after you confirm.">
              <input
                inputMode="numeric"
                maxLength={5}
                value={draft.zip}
                onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value.replace(/\D/g, "") }))}
                className={inputClass}
                placeholder="90250"
              />
            </Field>
            <Field label="City">
              <input value={draft.city} onChange={set("city")} className={inputClass} placeholder="Hawthorne" />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label={`Pay per ${unitLabel}`}
                hint={r.rateMin != null ? `${r.name.split(" ")[0]}'s rate: $${r.rateMin}${r.rateMax && r.rateMax !== r.rateMin ? `–${r.rateMax}` : ""}/${unitLabel}` : undefined}
              >
                <div className={`flex items-center ${inputClass}`}>
                  <span className="text-neutral-500">$</span>
                  <input
                    inputMode="decimal"
                    value={draft.pay}
                    onChange={(e) => setDraft((d) => ({ ...d, pay: e.target.value.replace(/[^\d.]/g, "") }))}
                    className="w-full bg-transparent pl-1 outline-none"
                  />
                </div>
              </Field>
              {payTooLow && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Below this ref&apos;s minimum of ${r.rateMin}/{unitLabel}.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes for the ref" hint="Age group, level, field number… (no phone numbers or emails)">
                <textarea value={draft.notes} onChange={set("notes")} rows={3} className={inputClass} />
              </Field>
            </div>
          </div>
        </section>

        {/* Summary + action */}
        <aside>
          <div className="rounded-2xl border border-neutral-200 p-6 shadow-[0_6px_16px_rgba(0,0,0,0.08)] lg:sticky lg:top-[calc(var(--marketing-header-height)+24px)]">
            <div className="flex items-center gap-4">
              {r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--navy)] text-lg font-bold text-white">
                  {r.initials}
                </div>
              )}
              <div>
                <p className="flex items-center gap-2 font-semibold text-neutral-900">
                  {r.name}
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Verified</span>
                </p>
                <p className="text-sm text-neutral-600">
                  {sportEmoji(r.primarySport)} {r.primarySport} Official
                  {r.certificationLevel ? ` · ${r.certificationLevel}` : ""}
                </p>
                <p className="text-xs text-neutral-500">{r.gotrefsId}</p>
              </div>
            </div>

            <dl className="mt-5 space-y-2 border-t border-neutral-200 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Pay</dt>
                <dd className="font-medium text-neutral-900">{draft.pay ? `$${draft.pay}/${unitLabel}` : "—"}</dd>
              </div>
              {r.rateUnit === "hour" && (
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Length</dt>
                  <dd className="font-medium text-neutral-900">{hours ? `${hours} hr` : "—"}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-2 text-base">
                <dt className="font-semibold text-neutral-900">Estimated total</dt>
                <dd className="font-semibold text-neutral-900">{estimate ? `$${estimate.toFixed(2)}` : "—"}</dd>
              </div>
            </dl>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {viewerRole === "organizer" ? (
              <button
                type="button"
                onClick={() => void sendRequest()}
                disabled={sending}
                className="mt-5 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send request"}
              </button>
            ) : viewerRole === "ref" ? (
              <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You&apos;re signed in with a referee account. Log in as an event organizer to request refs.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => continueToAccount("signup")}
                  className="mt-5 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)]"
                >
                  Continue
                </button>
                <p className="mt-3 text-center text-sm text-neutral-600">
                  Next, create a free organizer account. Already have one?{" "}
                  <button type="button" onClick={() => continueToAccount("login")} className="font-semibold text-neutral-900 underline">
                    Log in
                  </button>
                </p>
              </>
            )}
            <p className="mt-4 text-center text-xs text-neutral-500">You won&apos;t be charged until the ref accepts.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
