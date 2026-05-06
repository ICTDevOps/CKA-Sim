"use client";

import { useLocale, useTranslations } from "next-intl";
import { isCommandQuestion, type Question } from "@/lib/questions";
import { localized, type Locale } from "@/lib/questions/types";

interface FeedbackProps {
  question: Question;
  correct: boolean;
  userInput: string;
}

export function Feedback({ question, correct, userInput }: FeedbackProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("feedback");
  const expected = isCommandQuestion(question)
    ? question.challenge.expected
    : "—";
  const explanation = isCommandQuestion(question)
    ? localized(question.challenge.explanation, locale)
    : "";

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
        {correct ? t("correct") : t("incorrect")}
      </p>
      {!correct && userInput && (
        <p className="mt-2">
          <span className="text-terminal-dim">{t("yourInput")} </span>
          <code className="text-terminal-ko">{userInput}</code>
        </p>
      )}
      <p className="mt-2">
        <span className="text-terminal-dim">{t("expected")} </span>
        <code className="text-terminal-accent">{expected}</code>
      </p>
      {explanation && (
        <p className="mt-2 text-terminal-fg/90">{explanation}</p>
      )}
    </div>
  );
}
