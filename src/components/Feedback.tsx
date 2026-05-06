"use client";

import { isCommandQuestion, type Question } from "@/lib/questions";

interface FeedbackProps {
  question: Question;
  correct: boolean;
  userInput: string;
}

export function Feedback({ question, correct, userInput }: FeedbackProps) {
  const expected = isCommandQuestion(question)
    ? question.challenge.expected
    : "—";
  const explanation = isCommandQuestion(question)
    ? question.challenge.explanation
    : undefined;

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${
        correct
          ? "border-terminal-ok/60 bg-terminal-ok/10"
          : "border-terminal-ko/60 bg-terminal-ko/10"
      }`}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">
        {correct ? "✓ Correct." : "✗ Pas tout à fait."}
      </p>
      {!correct && userInput && (
        <p className="mt-2">
          <span className="text-terminal-dim">Ta saisie : </span>
          <code className="text-terminal-ko">{userInput}</code>
        </p>
      )}
      <p className="mt-2">
        <span className="text-terminal-dim">Commande attendue : </span>
        <code className="text-terminal-accent">{expected}</code>
      </p>
      {explanation && (
        <p className="mt-2 text-terminal-fg/90">{explanation}</p>
      )}
    </div>
  );
}
