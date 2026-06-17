import { FAQ_SECTIONS, type FaqItem } from "@/data/faq-content";

export type FaqMatch = {
  section: string;
  item: FaqItem;
  score: number;
};

export function formatFaqAnswer(item: FaqItem): string {
  if (item.bullets?.length) {
    return item.bullets.map((b) => `• ${b}`).join("\n");
  }
  return item.a ?? "";
}

/** Simple keyword search over FAQ — used before calling AI. */
export function searchFaq(query: string): FaqMatch | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;

  let best: FaqMatch | null = null;

  for (const section of FAQ_SECTIONS) {
    for (const item of section.items) {
      const haystack = [item.q, item.a ?? "", ...(item.bullets ?? [])].join(" ").toLowerCase();
      let score = 0;

      if (haystack.includes(query.toLowerCase().trim())) score += 8;

      for (const token of tokens) {
        if (item.q.toLowerCase().includes(token)) score += 3;
        if (haystack.includes(token)) score += 1;
      }

      if (!best || score > best.score) {
        best = { section: section.title, item, score };
      }
    }
  }

  if (!best || best.score < 2) return null;
  return best;
}

export function buildFaqKnowledgeBase(): string {
  return FAQ_SECTIONS.map((section) => {
    const items = section.items
      .map((item) => `Q: ${item.q}\nA: ${formatFaqAnswer(item)}`)
      .join("\n\n");
    return `## ${section.title}\n${items}`;
  }).join("\n\n");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "can",
  "how",
  "what",
  "does",
  "with",
  "that",
  "this",
  "from",
  "have",
  "about",
  "your",
  "you",
  "gotrefs",
]);

export const FAQ_QUICK_CHIPS = [
  "What is GotREFS?",
  "How do I get verified?",
  "Is it free for referees?",
  "How do organizers find officials?",
  "Are officials background checked?",
  "What makes GotREFS different?",
] as const;

export const FAQ_TAB_SHORT: Record<string, string> = {
  "General Questions": "General",
  "For Referees": "Referees",
  "For Event Organizers": "Organizers",
  "Verification & Safety": "Safety",
  "Platform Features": "Features",
  Pricing: "Pricing",
  "Why GotREFS?": "Why GotREFS",
};

export const FAQ_VISIBLE_PER_TAB = 4;
