"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Small circled-i control that shows helper text on click (and closes on outside click). */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-400 text-[10px] font-bold leading-none text-neutral-500 transition hover:border-neutral-600 hover:text-neutral-800"
      >
        i
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+6px)] z-20 w-56 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-neutral-600 shadow-lg sm:w-64"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
