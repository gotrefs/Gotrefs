"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicRefListing } from "@/lib/marketplace/public-refs";
import { PLATFORM_FEE_PERCENT_LABEL, PLATFORM_FEE_RATE } from "@/lib/platform-fee";
import { sportEmoji } from "@/lib/sport-emoji";

type Draft = {
  sport: string;
  date: string;
  start: string;
  /** Hours for hourly refs, number of games for per-game refs. */
  amount: number;
  zip: string;
  pay: string;
  notes: string;
};

const DRAFT_KEY = "gotrefs_ref_request_draft";
/** Where to send a brand-new organizer after signup / email confirmation. */
export const POST_SIGNUP_NEXT_KEY = "gotrefs_post_signup_next";
/** Assumed length of one game when a ref charges per game (sets the event end time). */
const HOURS_PER_GAME = 1.5;

function loadDraft(gotrefsId: string): Partial<Draft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { gotrefsId: string; draft: Partial<Draft> };
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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const cellLabel = "block text-[10px] font-bold uppercase tracking-wide text-neutral-900";
const cellInput = "mt-0.5 w-full bg-transparent text-sm text-neutral-900 outline-none";

export function RequestRefForm({
  listing: r,
  viewerRole,
}: {
  listing: PublicRefListing;
  viewerRole: "organizer" | "ref" | null;
}) {
  const perGame = r.rateUnit === "game";
  const unitLabel = perGame ? "game" : "hour";
  const firstName = r.name.split(" ")[0];

  const [draft, setDraft] = useState<Draft>({
    sport: r.primarySport,
    date: "",
    start: "",
    amount: perGame ? 1 : 2,
    zip: "",
    pay: r.rateMin != null ? String(r.rateMin) : "",
    notes: "",
  });
  const [restored, setRestored] = useState(false);
  const [showPay, setShowPay] = useState(r.rateMin == null);
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openingCard, setOpeningCard] = useState(false);
  const [sendAfterCard, setSendAfterCard] = useState(false);

  // Bring back what the organizer picked before they created an account.
  useEffect(() => {
    try {
      localStorage.removeItem(POST_SIGNUP_NEXT_KEY);
    } catch {
      // ignore
    }
    const saved = loadDraft(r.gotrefsId);
    if (saved) {
      // localStorage only exists after hydration, so restoring has to happen in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft((d) => ({ ...d, ...saved, amount: Number(saved.amount) > 0 ? Number(saved.amount) : d.amount }));
      if (saved.notes) setShowNotes(true);
      setRestored(true);
    }
  }, [r.gotrefsId]);

  /** Change a field and clear any leftover error message. */
  const update = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const payNum = Number(draft.pay);
  const payValid = draft.pay !== "" && Number.isFinite(payNum) && payNum > 0;
  const payTooLow = payValid && r.rateMin != null && payNum < r.rateMin;
  // Mirrors what the organizer is charged when the ref accepts:
  // pay × units + service fee on that pay + a refundable deposit of one unit.
  const subtotal = payValid ? payNum * draft.amount : null;
  const fee = subtotal != null ? Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100 : null;
  const deposit = payValid ? payNum : null;
  const total = subtotal != null && fee != null && deposit != null ? subtotal + fee + deposit : null;
  const amountOptions = useMemo(() => (perGame ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 8]), [perGame]);
  const amountText = (n: number) =>
    perGame ? `${n} game${n === 1 ? "" : "s"}` : `${n} hour${n === 1 ? "" : "s"}`;

  function validate(): string | null {
    if (!draft.date) return "Pick the date of your game.";
    if (!draft.start) return "Pick a start time.";
    if (!/^\d{5}$/.test(draft.zip.trim())) return "Enter the 5-digit ZIP code of the game.";
    if (!payValid) return "Enter what you'll pay.";
    if (payTooLow) return `${firstName}'s minimum is $${r.rateMin}/${unitLabel}.`;
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
    try {
      // Lets the dashboard send them back here after they confirm their email.
      localStorage.setItem(POST_SIGNUP_NEXT_KEY, JSON.stringify({ path: returnPath, at: Date.now() }));
    } catch {
      // ignore
    }
    const next = encodeURIComponent(returnPath);
    window.location.assign(
      kind === "signup" ? `/join/organizer?next=${next}` : `/auth/login?next=${next}`
    );
  }

  /** Booking is when a card is needed: open Stripe's card form, then come back here. */
  async function openCardForm() {
    saveDraft(r.gotrefsId, draft);
    setOpeningCard(true);
    const res = await fetch("/api/stripe/organizer-payment-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "onboard", returnTo: returnPath }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setOpeningCard(false);
      throw new Error(json.error || "Could not open the secure card form. Try again.");
    }
    window.location.assign(json.url);
  }

  async function sendRequest(options: { afterCard?: boolean } = {}) {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    try {
      if (!options.afterCard) {
        const pmRes = await fetch("/api/stripe/organizer-payment-method");
        const pm = (await pmRes.json()) as { ready?: boolean };
        if (pmRes.ok && !pm.ready) {
          await openCardForm();
          return;
        }
      }

      const startsAt = new Date(`${draft.date}T${draft.start}`);
      const hours = perGame ? draft.amount * HOURS_PER_GAME : draft.amount;
      const endsAt = new Date(startsAt.getTime() + hours * 3600 * 1000);
      const eventRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${draft.sport} game`,
          sport: draft.sport,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          zip_code: draft.zip.trim(),
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
        body: JSON.stringify({
          eventId: eventJson.id,
          refMemberId: r.id,
          offeredPay: payNum,
          // The booking system bills rate × this count (hours for hourly refs, games otherwise).
          gamesCount: draft.amount,
        }),
      });
      const offerJson = (await offerRes.json()) as { error?: string; code?: string };
      if (!offerRes.ok && offerJson.code === "missing_payment_method") {
        if (options.afterCard) {
          throw new Error("We couldn't confirm your card yet. Tap Request to try again.");
        }
        await openCardForm();
        return;
      }
      if (!offerRes.ok) throw new Error(offerJson.error || "Could not send the request.");

      clearDraft();
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Keep a handle on the latest sendRequest so the "back from Stripe" effect can call it.
  const sendRequestRef = useRef(sendRequest);
  useEffect(() => {
    sendRequestRef.current = sendRequest;
  });

  // Back from Stripe's card form: save the card, tidy the URL, then send the request.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pm = params.get("pm");
    if (!pm) return;
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);
    if (pm === "cancel") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No card was added, so the request wasn't sent. Tap Request when you're ready.");
      return;
    }
    if (pm !== "return" || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/organizer-payment-method", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_checkout_session", sessionId }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setError(json.error || "We couldn't confirm your card. Tap Request to try again.");
          return;
        }
        setSendAfterCard(true);
      } catch {
        if (!cancelled) setError("We couldn't confirm your card. Tap Request to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sendAfterCard) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSendAfterCard(false);
    void sendRequestRef.current({ afterCard: true });
  }, [sendAfterCard]);

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

  const rateLine =
    r.rateMin == null
      ? null
      : r.rateMax != null && r.rateMax !== r.rateMin
        ? `$${r.rateMin}–${r.rateMax}`
        : `$${r.rateMin}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href="/find-refs" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">
        ← Back to refs
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        {/* Who you're requesting */}
        <section>
          <div className="flex items-center gap-5">
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover sm:h-28 sm:w-28" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[var(--navy)] text-3xl font-bold text-white sm:h-28 sm:w-28">
                {r.initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{r.name}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ Verified</span>
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
                {sportEmoji(r.primarySport)} {r.primarySport} Official
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                {[r.certificationLevel, r.place].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-neutral-200 py-5 text-sm sm:grid-cols-3">
            {r.ratingCount > 0 && (
              <div>
                <dt className="text-neutral-500">Rating</dt>
                <dd className="mt-0.5 font-semibold text-neutral-900">
                  ★ {r.ratingAverage} ({r.ratingCount})
                </dd>
              </div>
            )}
            {r.gamesCompleted > 0 && (
              <div>
                <dt className="text-neutral-500">Games on GoTRefs</dt>
                <dd className="mt-0.5 font-semibold text-neutral-900">{r.gamesCompleted}</dd>
              </div>
            )}
            {r.travelRadiusMiles != null && (
              <div>
                <dt className="text-neutral-500">Travels</dt>
                <dd className="mt-0.5 font-semibold text-neutral-900">Up to {r.travelRadiusMiles} mi</dd>
              </div>
            )}
            <div>
              <dt className="text-neutral-500">GoTRefs ID</dt>
              <dd className="mt-0.5 font-semibold text-neutral-900">
                <Link href={`/verify/${encodeURIComponent(r.gotrefsId)}`} className="underline">
                  {r.gotrefsId}
                </Link>
              </dd>
            </div>
          </dl>

          {r.bio && <p className="mt-5 leading-7 text-neutral-700">{r.bio}</p>}

          {r.sports.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {r.sports.map((s) => (
                <span key={s} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Booking box */}
        <aside>
          <div className="rounded-2xl border border-neutral-200 p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] lg:sticky lg:top-[calc(var(--marketing-header-height)+24px)]">
            <p className="text-neutral-900">
              {rateLine ? (
                <>
                  <span className="text-2xl font-semibold">{rateLine}</span>{" "}
                  <span className="text-neutral-600">/ {unitLabel}</span>
                </>
              ) : (
                <span className="text-lg font-semibold">Name your pay</span>
              )}
            </p>

            {restored && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Welcome back — your game is saved. Tap Request to send it.
              </p>
            )}

            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-400">
              <div className="grid grid-cols-2 divide-x divide-neutral-400">
                <label className="block px-3 py-2.5">
                  <span className={cellLabel}>Date</span>
                  <input
                    type="date"
                    min={todayIso()}
                    value={draft.date}
                    onChange={(e) => update({ date: e.target.value })}
                    className={cellInput}
                  />
                </label>
                <label className="block px-3 py-2.5">
                  <span className={cellLabel}>Start time</span>
                  <input
                    type="time"
                    value={draft.start}
                    onChange={(e) => update({ start: e.target.value })}
                    className={cellInput}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 divide-x divide-neutral-400 border-t border-neutral-400">
                <label className="block px-3 py-2.5">
                  <span className={cellLabel}>{perGame ? "Games" : "How long"}</span>
                  <select
                    value={draft.amount}
                    onChange={(e) => update({ amount: Number(e.target.value) })}
                    className={cellInput}
                  >
                    {amountOptions.map((n) => (
                      <option key={n} value={n}>
                        {amountText(n)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block px-3 py-2.5">
                  <span className={cellLabel}>ZIP code</span>
                  <input
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Where's the game?"
                    value={draft.zip}
                    onChange={(e) => update({ zip: e.target.value.replace(/\D/g, "") })}
                    className={cellInput}
                  />
                </label>
              </div>
              {r.sports.length > 1 && (
                <label className="block border-t border-neutral-400 px-3 py-2.5">
                  <span className={cellLabel}>Sport</span>
                  <select
                    value={draft.sport}
                    onChange={(e) => update({ sport: e.target.value })}
                    className={cellInput}
                  >
                    {r.sports.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {showPay && (
                <label className="block border-t border-neutral-400 px-3 py-2.5">
                  <span className={cellLabel}>Pay per {unitLabel}</span>
                  <span className="mt-0.5 flex items-center text-sm text-neutral-900">
                    $
                    <input
                      inputMode="decimal"
                      value={draft.pay}
                      onChange={(e) => update({ pay: e.target.value.replace(/[^\d.]/g, "") })}
                      className="w-full bg-transparent pl-0.5 outline-none"
                    />
                  </span>
                </label>
              )}
              {showNotes && (
                <label className="block border-t border-neutral-400 px-3 py-2.5">
                  <span className={cellLabel}>Note for {firstName}</span>
                  <textarea
                    rows={2}
                    placeholder="Age group, level, field… (no phone numbers or emails)"
                    value={draft.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                    className={`${cellInput} resize-none`}
                  />
                </label>
              )}
            </div>

            {payTooLow && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Below {firstName}&apos;s minimum of ${r.rateMin}/{unitLabel}.
              </p>
            )}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {viewerRole === "ref" ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You&apos;re signed in with a referee account. Log in as an event organizer to request refs.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => (viewerRole === "organizer" ? void sendRequest() : continueToAccount("signup"))}
                disabled={sending || openingCard}
                className="mt-4 w-full rounded-xl bg-[var(--red)] py-3.5 text-base font-semibold text-white hover:bg-[var(--red-dark)] disabled:opacity-60"
              >
                {openingCard ? "Opening secure card form…" : sending ? "Sending…" : "Request"}
              </button>
            )}
            <p className="mt-3 text-center text-sm text-neutral-600">You won&apos;t be charged yet</p>

            {total != null && subtotal != null && fee != null && deposit != null && (
              <dl className="mt-4 space-y-2 text-[15px] text-neutral-700">
                <div className="flex justify-between">
                  <dt>
                    ${draft.pay} × {amountText(draft.amount)}
                  </dt>
                  <dd>${subtotal.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>GoTRefs service fee ({PLATFORM_FEE_PERCENT_LABEL})</dt>
                  <dd>${fee.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Refundable deposit</dt>
                  <dd>${deposit.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-3 font-semibold text-neutral-900">
                  <dt>Total when {firstName} accepts</dt>
                  <dd>${total.toFixed(2)}</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
              {!showNotes && (
                <button type="button" onClick={() => setShowNotes(true)} className="font-semibold text-neutral-700 underline">
                  Add a note
                </button>
              )}
              {!showPay && (
                <button type="button" onClick={() => setShowPay(true)} className="font-semibold text-neutral-700 underline">
                  Change pay
                </button>
              )}
              {viewerRole === null && (
                <button type="button" onClick={() => continueToAccount("login")} className="font-semibold text-neutral-700 underline">
                  I have an account
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
