import { NextResponse } from "next/server";
import { buildFaqKnowledgeBase, formatFaqAnswer, searchFaq } from "@/lib/faq-knowledge";

type AskBody = { question?: string };

const FALLBACK =
  "I couldn't find a exact match in our FAQ. For personal help, email hello@gotrefs.org or sign up at gotrefs.org/auth/signup to explore the platform.";

export async function POST(request: Request) {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  const match = searchFaq(question);
  if (match && match.score >= 4) {
    return NextResponse.json({
      answer: formatFaqAnswer(match.item),
      source: "faq" as const,
      matchedQuestion: match.item.q,
      section: match.section,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const answer = await askOpenAi(apiKey, question);
      return NextResponse.json({
        answer,
        source: "ai" as const,
        matchedQuestion: match?.item.q ?? null,
      });
    } catch (err) {
      console.error("[api/faq/ask] OpenAI:", err);
    }
  }

  if (match) {
    return NextResponse.json({
      answer: formatFaqAnswer(match.item),
      source: "faq" as const,
      matchedQuestion: match.item.q,
      section: match.section,
    });
  }

  return NextResponse.json({
    answer: FALLBACK,
    source: "fallback" as const,
  });
}

async function askOpenAi(apiKey: string, question: string): Promise<string> {
  const knowledge = buildFaqKnowledgeBase();
  const system = `You are the GotREFS FAQ assistant on gotrefs.org. Answer briefly (2-4 sentences unless listing items). Use ONLY the FAQ knowledge below. If the answer is not covered, say so and suggest hello@gotrefs.org or signing up as a ref (/auth/signup?role=ref) or organizer (/auth/signup?role=organizer). Do not invent pricing or features not in the FAQ.

FAQ KNOWLEDGE:
${knowledge}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 450,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200));
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");
  return content;
}
