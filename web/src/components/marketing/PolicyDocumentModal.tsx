"use client";

import { BrandName } from "@/components/BrandName";
import { normalizeBrandInText } from "@/lib/brand";
import type { PolicyDocument } from "@/data/policies";

type PolicyDocumentModalProps = {
  policy: PolicyDocument;
  onClose: () => void;
};

export function PolicyDocumentModal({ policy, onClose }: PolicyDocumentModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 text-[var(--navy)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">
              <BrandName /> Policy
            </p>
            <h2 id="policy-modal-title" className="mt-2 text-2xl font-black">
              {normalizeBrandInText(policy.title)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {normalizeBrandInText(policy.summary)}
            </p>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">{policy.effectiveDate}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-[var(--navy)] hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {policy.sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-black text-[var(--navy)]">{normalizeBrandInText(section.title)}</h3>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {normalizeBrandInText(paragraph)}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
                  {section.bullets.map((item) => (
                    <li key={item}>{normalizeBrandInText(item)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Questions? Email{" "}
          <a href={`mailto:${policy.contactEmail}`} className="font-bold text-[var(--navy)] underline">
            {policy.contactEmail}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
