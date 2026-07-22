"use client";

export function RequestSentSuccessModal({
  refLabel,
  onGoToNextEvent,
  onStay,
}: {
  refLabel: string;
  onGoToNextEvent: () => void;
  onStay: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Request sent</p>
        <h2 className="mt-2 text-2xl font-semibold text-neutral-900">Request sent to {refLabel}!</h2>
        <p className="mt-2 text-sm text-neutral-500">
          They&apos;ll get an email and can accept or decline from their referee dashboard. Exact address stays hidden until they accept.
        </p>
        <div className="mt-6 grid gap-2">
          <button
            type="button"
            onClick={onGoToNextEvent}
            className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Go to Next Event
          </button>
          <button
            type="button"
            onClick={onStay}
            className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Stay on this Event
          </button>
        </div>
      </div>
    </div>
  );
}
