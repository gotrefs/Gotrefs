"use client";

import { useState } from "react";
import { POLICY_DOCUMENTS, type PolicyDocument } from "@/data/policies";

const FOOTER_POLICIES = POLICY_DOCUMENTS.filter((policy) =>
  [
    "privacy-policy",
    "payment-fee-policy",
    "event-organizer-terms",
    "referee-official-terms",
    "background-check-verification",
    "community-standards",
    "verified-program",
  ].includes(policy.slug)
);

function shortLabel(policy: PolicyDocument) {
  switch (policy.slug) {
    case "privacy-policy":
      return "Privacy";
    case "payment-fee-policy":
      return "Payments";
    case "event-organizer-terms":
      return "Organizer Terms";
    case "referee-official-terms":
      return "Ref Terms";
    case "background-check-verification":
      return "Background Checks";
    case "community-standards":
      return "Community Standards";
    case "verified-program":
      return "Verified Program";
    default:
      return policy.title;
  }
}

export function PolicyFooterLinks() {
  const [activePolicy, setActivePolicy] = useState<PolicyDocument | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-white/60 sm:justify-end">
        {FOOTER_POLICIES.map((policy) => (
          <button
            key={policy.slug}
            type="button"
            onClick={() => setActivePolicy(policy)}
            className="font-semibold underline-offset-4 hover:text-white hover:underline"
          >
            {shortLabel(policy)}
          </button>
        ))}
      </div>

      {activePolicy && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
          onClick={() => setActivePolicy(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 text-[var(--navy)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--red)]">GotREFS Policy</p>
                <h2 id="policy-modal-title" className="mt-2 text-2xl font-black">{activePolicy.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{activePolicy.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-[var(--navy)] hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {activePolicy.sections.map((section) => (
                <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black text-[var(--navy)]">{section.title}</h3>
                  {section.body?.map((paragraph) => (
                    <p key={paragraph} className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--muted)]">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
