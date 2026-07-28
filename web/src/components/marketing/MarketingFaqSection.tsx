"use client";

import { useMemo, useState } from "react";
import {
  FAQ_PAGE_TITLE,
  FAQ_SECTIONS,
  type FaqItem,
} from "@/data/faq-content";
import {
  FAQ_QUICK_CHIPS,
  FAQ_TAB_SHORT,
  FAQ_VISIBLE_PER_TAB,
} from "@/lib/faq-knowledge";

function FaqAnswer({ item }: { item: FaqItem }) {
  if (item.bullets?.length) {
    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--muted)] md:text-sm">
        {item.bullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }
  return <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] md:text-sm">{item.a}</p>;
}

function tabIndexForChip(chip: string): number {
  if (chip.includes("free")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "For Referees");
  }
  if (chip.includes("organizers find")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "For Event Organizers");
  }
  if (chip.includes("background")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "Verification & Safety");
  }
  if (chip.includes("different")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "General Questions");
  }
  if (chip.includes("verified")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "For Referees");
  }
  return 0;
}

function questionForChip(chip: string): string {
  if (chip === "Is it free for referees?") return "Is there a cost to join?";
  if (chip === "How do organizers find officials?") {
    return "How does GotRefs help me find officials?";
  }
  return chip;
}

export function MarketingFaqSection() {
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const section = FAQ_SECTIONS[tabIndex];
  const visibleItems = useMemo(() => {
    if (expanded) return section.items;
    return section.items.slice(0, FAQ_VISIBLE_PER_TAB);
  }, [section.items, expanded]);

  function selectQuickChip(chip: string) {
    const nextTab = tabIndexForChip(chip);
    const question = questionForChip(chip);
    setTabIndex(nextTab >= 0 ? nextTab : 0);
    setExpanded(true);
    setOpenQuestion(question);
  }

  return (
    <section
      className="viewport-screen scroll-mt-[4.25rem] flex flex-col justify-center border-t border-[var(--border)] bg-white px-4"
      id="faq"
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col justify-center">
        <h2 className="marketing-headline-dense shrink-0 text-center text-[#1b2132]">{FAQ_PAGE_TITLE}</h2>

        <div className="mt-3 flex shrink-0 flex-wrap justify-center gap-2">
          {FAQ_QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => selectQuickChip(chip)}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-[#1b2132] transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue)]/5 md:text-sm"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="mt-3 flex shrink-0 gap-1 overflow-x-auto pb-1">
          {FAQ_SECTIONS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => {
                setTabIndex(i);
                setExpanded(false);
                setOpenQuestion(null);
              }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors md:text-sm ${
                tabIndex === i
                  ? "bg-[var(--blue)] text-white"
                  : "bg-[var(--grey-light)] text-[#1b2132] hover:bg-[var(--border)]"
              }`}
            >
              {FAQ_TAB_SHORT[s.title] ?? s.title}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-white">
          <div className="divide-y divide-[var(--border)]">
            {visibleItems.map((item) => (
              <details
                key={item.q}
                className="group px-4 py-2.5 md:px-5 md:py-3"
                open={openQuestion === item.q}
                onToggle={(e) => {
                  const open = (e.target as HTMLDetailsElement).open;
                  setOpenQuestion(open ? item.q : null);
                }}
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#1b2132] marker:content-none group-open:text-[var(--red)] md:text-base">
                  {item.q}
                </summary>
                <FaqAnswer item={item} />
              </details>
            ))}
          </div>
          {section.items.length > FAQ_VISIBLE_PER_TAB && (
            <button
              type="button"
              className="sticky bottom-0 w-full border-t border-[var(--border)] bg-white py-2.5 text-center text-xs font-semibold text-[var(--blue)] hover:bg-[var(--grey-light)] md:text-sm"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded
                ? "Show fewer questions"
                : `Show all ${section.items.length} questions in ${FAQ_TAB_SHORT[section.title]}`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
