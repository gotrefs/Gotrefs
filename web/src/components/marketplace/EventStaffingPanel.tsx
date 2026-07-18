"use client";

import { useMemo, useState } from "react";
import { RefReviewsButton } from "@/components/reviews/RefReviewsButton";
import { payRangesOverlap } from "@/lib/pay-range";

type StaffingEvent = {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string;
  zip_code: string;
  officials_needed: number;
  pay_offer: number | null;
  pay_type?: "exact" | "range" | null;
  pay_min?: number | null;
  pay_max?: number | null;
};

type Applicant = {
  id: string;
  eventId: string;
  refMemberId: string;
  gotrefsId: string;
  eventTitle: string;
  ratingAverage: number | null;
  ratingCount: number;
  refRateLabel: string | null;
  eventPayLabel: string | null;
};

type DirectoryRef = {
  id: string;
  gotrefsId: string;
  primarySport: string;
  ratingAverage: number | null;
  ratingCount: number;
  rateLabel: string | null;
  homeZip: string | null;
  availability: { start_at: string; end_at: string }[];
  rateType?: string | null;
  rateMin?: number | null;
  rateMax?: number | null;
  ratePerGame?: number | null;
};

function slotCoversEvent(slot: { start_at: string; end_at: string }, event: StaffingEvent) {
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  const slotStart = new Date(slot.start_at).getTime();
  const slotEnd = new Date(slot.end_at).getTime();
  return slotStart <= start && slotEnd >= end;
}

function eventPayInput(event: StaffingEvent) {
  return {
    type: event.pay_type === "range" ? ("range" as const) : ("exact" as const),
    exact: event.pay_offer,
    min: event.pay_min,
    max: event.pay_max,
  };
}

function refPayInput(ref: DirectoryRef) {
  return {
    type: ref.rateType === "range" ? ("range" as const) : ("exact" as const),
    exact: ref.ratePerGame ?? ref.rateMin,
    min: ref.rateMin,
    max: ref.rateMax,
  };
}

export function EventStaffingPanel({
  event,
  applicants,
  refs,
  hiredCount,
  onClose,
  onInviteApplicant,
  onInviteRef,
}: {
  event: StaffingEvent;
  applicants: Applicant[];
  refs: DirectoryRef[];
  hiredCount: number;
  onClose: () => void;
  onInviteApplicant: (applicant: Applicant) => Promise<void>;
  onInviteRef: (refId: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"applicants" | "suggested">("applicants");
  const [busyId, setBusyId] = useState<string | null>(null);

  const eventApplicants = useMemo(
    () => applicants.filter((row) => row.eventId === event.id),
    [applicants, event.id]
  );

  const suggestedRefs = useMemo(() => {
    return refs
      .filter((ref) => {
        const sportMatch =
          ref.primarySport.trim().toLowerCase() === event.sport.trim().toLowerCase();
        const zipMatch = !ref.homeZip || ref.homeZip === event.zip_code;
        const available = ref.availability.some((slot) => slotCoversEvent(slot, event));
        const payMatch = payRangesOverlap(refPayInput(ref), eventPayInput(event));
        return sportMatch && zipMatch && available && payMatch;
      })
      .slice(0, 12);
  }, [refs, event]);

  async function inviteApplicant(applicant: Applicant) {
    setBusyId(applicant.id);
    try {
      await onInviteApplicant(applicant);
    } finally {
      setBusyId(null);
    }
  }

  async function inviteRef(refId: string) {
    setBusyId(refId);
    try {
      await onInviteRef(refId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">Staff this game</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--navy)]">{event.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {event.sport} · {new Date(event.starts_at).toLocaleString()} · ZIP {event.zip_code}
            </p>
            <p className="mt-2 text-sm font-bold text-[var(--navy)]">
              {hiredCount}/{event.officials_needed} refs confirmed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--navy)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("applicants")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "applicants" ? "bg-[var(--navy)] text-white" : "border border-[var(--border)]"
            }`}
          >
            Applicants ({eventApplicants.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("suggested")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "suggested" ? "bg-[var(--navy)] text-white" : "border border-[var(--border)]"
            }`}
          >
            Suggested refs ({suggestedRefs.length})
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {tab === "applicants" &&
            (eventApplicants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
                No refs have applied yet. Check Suggested refs or browse the marketplace.
              </p>
            ) : (
              eventApplicants.map((applicant) => (
                <article key={applicant.id} className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="font-black text-[var(--navy)]">Official {applicant.gotrefsId}</p>
                  <div className="mt-1">
                    <RefReviewsButton
                      refMemberId={applicant.refMemberId}
                      title={`Official ${applicant.gotrefsId}`}
                      average={applicant.ratingAverage}
                      count={applicant.ratingCount}
                      emptyLabel="No reviews yet"
                    />
                  </div>
                  {applicant.refRateLabel && (
                    <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Ref rate: {applicant.refRateLabel}</p>
                  )}
                  <button
                    type="button"
                    disabled={busyId === applicant.id}
                    onClick={() => void inviteApplicant(applicant)}
                    className="mt-3 rounded-full bg-[var(--blue)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busyId === applicant.id ? "Sending…" : "Send invite"}
                  </button>
                </article>
              ))
            ))}

          {tab === "suggested" &&
            (suggestedRefs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-slate-50 p-5 text-sm text-[var(--muted)]">
                No refs match availability, sport, ZIP, and pay for this game. Refs can still apply from Find Games.
              </p>
            ) : (
              suggestedRefs.map((ref) => (
                <article key={ref.id} className="rounded-2xl border border-[var(--border)] p-4">
                  <p className="font-black text-[var(--navy)]">Official {ref.gotrefsId}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {ref.primarySport}
                    {ref.rateLabel ? ` · ${ref.rateLabel}` : ""}
                  </p>
                  <div className="mt-1">
                    <RefReviewsButton
                      refMemberId={ref.id}
                      title={`Official ${ref.gotrefsId}`}
                      average={ref.ratingAverage}
                      count={ref.ratingCount}
                      emptyLabel="No reviews yet"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busyId === ref.id}
                    onClick={() => void inviteRef(ref.id)}
                    className="mt-3 rounded-full bg-[var(--red)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busyId === ref.id ? "Sending…" : "Invite to game"}
                  </button>
                </article>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}
