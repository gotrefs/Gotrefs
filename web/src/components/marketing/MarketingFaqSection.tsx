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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  matchedQuestion?: string | null;
};

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
    return FAQ_SECTIONS.findIndex((s) => s.title === "Why GotREFS?");
  }
  if (chip.includes("verified")) {
    return FAQ_SECTIONS.findIndex((s) => s.title === "For Referees");
  }
  return 0;
}

function questionForChip(chip: string): string {
  if (chip === "Is it free for referees?") return "Is there a cost to join?";
  if (chip === "How do organizers find officials?") {
    return "How does GotREFS help me find officials?";
  }
  return chip;
}

export function MarketingFaqSection() {
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [askInput, setAskInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm the GotREFS FAQ helper. Pick a topic, tap a popular question, or type anything below.",
    },
  ]);
  const [asking, setAsking] = useState(false);

  const section = FAQ_SECTIONS[tabIndex];
  const visibleItems = useMemo(() => {
    if (expanded) return section.items;
    return section.items.slice(0, FAQ_VISIBLE_PER_TAB);
  }, [section.items, expanded]);

  async function submitQuestion(question: string) {
    const q = question.trim();
    if (!q || asking) return;

    setChatOpen(true);
    setAskInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setAsking(true);

    try {
      const res = await fetch("/api/faq/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = (await res.json()) as {
        error?: string;
        answer?: string;
        matchedQuestion?: string | null;
      };

      const answer =
        json.answer ||
        json.error ||
        "Something went wrong. Email hello@gotrefs.org and we'll help you directly.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          matchedQuestion: json.matchedQuestion,
        },
      ]);

      if (json.matchedQuestion) setOpenQuestion(json.matchedQuestion);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Could not reach the FAQ helper. Try again or email hello@gotrefs.org.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function selectQuickChip(chip: string) {
    setTabIndex(tabIndexForChip(chip));
    void submitQuestion(questionForChip(chip));
  }

  return (
    <section className="viewport-screen flex flex-col bg-white px-4 py-5 md:py-6" id="faq">
      <div className="mx-auto flex w-full max-w-4xl flex-col lg:h-full lg:min-h-0">
        <h2 className="shrink-0 text-center text-xl font-bold text-[#1b2132] md:text-2xl">
          {FAQ_PAGE_TITLE}
        </h2>

        {!chatOpen ? (
          <>
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

            <div className="mt-4 flex shrink-0 gap-1 overflow-x-auto pb-1">
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

            <div className="mt-3 rounded-xl border border-[var(--border)] bg-white lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <div className="divide-y divide-[var(--border)]">
                {visibleItems.map((item) => (
                  <details
                    key={item.q}
                    className="group px-4 py-3 md:px-5"
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
                  className="w-full border-t border-[var(--border)] py-2.5 text-center text-xs font-semibold text-[var(--blue)] hover:bg-[var(--grey-light)] md:text-sm"
                  onClick={() => setExpanded((e) => !e)}
                >
                  {expanded
                    ? "Show fewer questions"
                    : `Show all ${section.items.length} questions in ${FAQ_TAB_SHORT[section.title]}`}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--grey-light)]/40 lg:min-h-0 lg:flex-1">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-4 py-2">
              <p className="text-sm font-semibold text-[#1b2132]">GotREFS FAQ helper</p>
              <button
                type="button"
                className="text-xs font-medium text-[var(--blue)] underline"
                onClick={() => setChatOpen(false)}
              >
                Back to FAQ
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[var(--blue)] text-white"
                        : "border border-[var(--border)] bg-white text-[#1b2132]"
                    }`}
                  >
                    {m.matchedQuestion && m.role === "assistant" && (
                      <p className="mb-1 text-xs font-semibold text-[var(--red)]">
                        Related: {m.matchedQuestion}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              {asking && <p className="text-xs text-[var(--muted)]">Thinking…</p>}
            </div>
          </div>
        )}

        <form
          className="mt-3 shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            void submitQuestion(askInput);
          }}
        >
          <label className="sr-only" htmlFor="faq-ask">
            Ask a question about GotREFS
          </label>
          <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-white p-2 shadow-sm">
            <input
              id="faq-ask"
              type="text"
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="Don't see your question? Ask anything about GotREFS…"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={asking || !askInput.trim()}
              className="shrink-0 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Ask
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[var(--muted)] md:text-xs">
            Answers use our FAQ first, then the GotREFS AI helper when an API key is configured.
          </p>
        </form>
      </div>
    </section>
  );
}
