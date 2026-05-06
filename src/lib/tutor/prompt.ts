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
  /** Question-author explanation (when present) — gives the model ground truth. */
  explanation?: string;
  /** Documentation URLs for reference (used as RAG hint until Sprint 4). */
  docUrls?: string[];
}

/**
 * Builds the system + user messages for a single tutor turn.
 *
 * Design notes:
 *  - The system prompt locks the model to short, exam-focused explanations.
 *  - We pass the question's canonical "expected" + author explanation as
 *    ground truth so the model doesn't have to guess kubectl details.
 *  - The model is told to reply in the user's locale (English or French).
 *  - We forbid speculation: if the user typed something the question's
 *    explanation doesn't cover, the model should say so.
 *  - No RAG yet (Sprint 4 will inject doc chunks before the user message).
 */
export function buildTutorMessages(ctx: TutorContext): LlmMessage[] {
  const lang = ctx.locale === "fr" ? "French" : "English";
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
    `the explanation.`;

  const docHints =
    ctx.docUrls && ctx.docUrls.length > 0
      ? `\nDocumentation hints: ${ctx.docUrls.join(", ")}`
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
    docHints;

  return [
    { role: "system", content: sys },
    { role: "user", content: user }
  ];
}
