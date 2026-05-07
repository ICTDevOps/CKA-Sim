import type { Locale } from "@/lib/questions/types";
import type { LlmMessage } from "@/lib/llm";

interface TutorContext {
  locale: Locale;
  scenario: string;
  domain: string;
  difficulty: number;
  expected: string;
  userInput: string;
  isCorrect: boolean;
  explanation?: string;
  docUrls?: string[];
  /** Retrieved KB chunks (Sprint 4 RAG). Empty when retrieval is disabled
   *  or unavailable — the tutor then falls back to its general knowledge. */
  ragChunks?: Array<{ sourceUrl: string; sourceSection: string; content: string }>;
}

/**
 * Builds the system + user messages for a single tutor turn.
 *
 * Design notes:
 *  - The system prompt locks the model to short, exam-focused explanations.
 *  - We pass the question's canonical "expected" + author explanation as
 *    ground truth so the model doesn't have to guess kubectl details.
 *  - The model is told to reply in the user's locale (English or French).
 *  - When RAG chunks are provided, the model MUST cite them inline using
 *    `[1]`, `[2]`, … markers. The client renders those as links to the
 *    `sources` event payload.
 *  - We forbid speculation: if the user typed something the question's
 *    explanation doesn't cover, the model should say so.
 */
export function buildTutorMessages(ctx: TutorContext): LlmMessage[] {
  const lang = ctx.locale === "fr" ? "French" : "English";
  const hasRag = (ctx.ragChunks?.length ?? 0) > 0;

  const sys =
    `You are the AI tutor inside CKA-Sim, a kubectl/shell/vi dexterity ` +
    `simulator for the Certified Kubernetes Administrator (CKA) exam. ` +
    `Your role is to coach the user *after* they submitted an answer.\n\n` +
    `Reply STRICTLY in ${lang}.\n\n` +
    `Style rules:\n` +
    `- Be concise: 2-4 short paragraphs maximum.\n` +
    `- Use Markdown: \`code\` for commands, \`-\` for lists.\n` +
    `- Focus on exam tactics: idiomatic flags, the \`k\` alias, ` +
    `\`--dry-run=client -o yaml\`, JSONPath, time-saving tricks.\n` +
    `- If the user was correct, optionally suggest a faster or more idiomatic ` +
    `variant. Never lecture for no reason.\n` +
    `- If the user was wrong, explain *why* (which flag is missing/wrong) ` +
    `before showing the correct command.\n` +
    `- Never invent kubectl flags. If you're unsure, say so explicitly.\n` +
    `- Do not start with "Of course" / "Sure" / "Bien sûr" — go straight to ` +
    `the explanation.` +
    (hasRag
      ? `\n\nGrounding:\n` +
        `- The user message includes a "Knowledge base extracts" section ` +
        `with numbered snippets [1], [2], …\n` +
        `- When you state a fact derived from a snippet, cite it inline ` +
        `with the matching marker, e.g. "use \`-A\` for all namespaces [2]".\n` +
        `- Prefer the KB extracts over your own memory; if the extracts ` +
        `contradict your prior, trust the extracts.`
      : "");

  const docHints =
    ctx.docUrls && ctx.docUrls.length > 0
      ? `\nDocumentation hints: ${ctx.docUrls.join(", ")}`
      : "";

  const ragBlock =
    hasRag && ctx.ragChunks
      ? `\n\nKnowledge base extracts:\n` +
        ctx.ragChunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.sourceSection} — ${c.sourceUrl}\n${c.content.slice(0, 1200)}`
          )
          .join("\n\n")
      : "";

  const user =
    `Scenario: ${ctx.scenario}\n` +
    `Domain: ${ctx.domain} · Difficulty: ${ctx.difficulty}/5\n` +
    `Canonical expected command: \`${ctx.expected}\`\n` +
    (ctx.explanation
      ? `Author explanation (ground truth — adapt to the user's situation): ${ctx.explanation}\n`
      : "") +
    `User typed: \`${ctx.userInput || "<empty>"}\`\n` +
    `Verdict: ${ctx.isCorrect ? "CORRECT" : "INCORRECT"}` +
    docHints +
    ragBlock;

  return [
    { role: "system", content: sys },
    { role: "user", content: user }
  ];
}
