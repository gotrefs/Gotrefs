"use client";

import { useState } from "react";
import type { PolicyDocument } from "@/data/policies";
import { PolicyDocumentModal } from "./PolicyDocumentModal";
import { MARKETING_POLICIES, policyShortLabel } from "./policy-utils";

type PolicyLinksPanelProps = {
  variant?: "footer" | "section";
};

export function PolicyLinksPanel({ variant = "section" }: PolicyLinksPanelProps) {
  const [activePolicy, setActivePolicy] = useState<PolicyDocument | null>(null);

  if (variant === "footer") {
    return (
      <>
        <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs text-white/60 sm:justify-end">
          {MARKETING_POLICIES.map((policy) => (
            <button
              key={policy.slug}
              type="button"
              onClick={() => setActivePolicy(policy)}
              className="font-semibold underline-offset-4 hover:text-white hover:underline"
            >
              {policyShortLabel(policy)}
            </button>
          ))}
        </div>
        {activePolicy && <PolicyDocumentModal policy={activePolicy} onClose={() => setActivePolicy(null)} />}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MARKETING_POLICIES.map((policy) => (
          <button
            key={policy.slug}
            type="button"
            onClick={() => setActivePolicy(policy)}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 text-left shadow-sm transition hover:border-[var(--blue)] hover:shadow-md"
          >
            <p className="text-sm font-bold text-[var(--navy)]">{policyShortLabel(policy)}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{policy.summary}</p>
            <span className="mt-3 inline-block text-xs font-bold text-[var(--blue)]">Read document →</span>
          </button>
        ))}
      </div>
      {activePolicy && <PolicyDocumentModal policy={activePolicy} onClose={() => setActivePolicy(null)} />}
    </>
  );
}
