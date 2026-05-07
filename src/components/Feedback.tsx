"use client";

import { useLocale, useTranslations } from "next-intl";
import { isCommandQuestion, type Question } from "@/lib/questions";
import { localized, type Locale } from "@/lib/questions/types";

interface FeedbackProps {
  question: Question;
  correct: boolean;
  userInput: string;
  /** vi-only: keystrokes the user actually pressed. */
  keystrokes?: number;
  /** vi-only: question's optimal keystroke count, for the efficiency ratio. */
  optimalKeystrokes?: number;
}

export function Feedback({
  question,
  correct,
  userInput,
  keystrokes,
  optimalKeystrokes
}: FeedbackProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("feedback");
  const isCmd = isCommandQuestion(question);

  const expected = isCmd ? question.challenge.expected : "";
  const explanation = localized(
    isCmd
      ? question.challenge.explanation
      : question.challenge.type === "vi"
      ? question.challenge.explanation
      : undefined,
    locale
  );

  // For vi: pick the first expected target as the "canonical" buffer to
  // display under "expected buffer".
  const expectedBuffer =
    question.challenge.type === "vi"
      ? Array.isArray(question.challenge.expectedBuffer)
        ? question.challenge.expectedBuffer[0]
        : question.challenge.expectedBuffer
      : null;

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
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {correct ? t("correct") : t("incorrect")}
        </p>
        {typeof keystrokes === "number" && (
          <p className="text-xs tabular-nums text-terminal-dim">
            {typeof optimalKeystrokes === "number"
              ? t("keystrokes", {
                  actual: keystrokes,
                  optimal: optimalKeystrokes,
                  ratio:
                    keystrokes === 0
                      ? "∞"
                      : (optimalKeystrokes / keystrokes).toFixed(2)
                })
              : t("keystrokesNoOptimal", { actual: keystrokes })}
          </p>
        )}
      </div>

      {isCmd ? (
        <>
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
        </>
      ) : (
        question.challenge.type === "vi" &&
        expectedBuffer !== null && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-terminal-dim hover:text-terminal-fg">
              {t("expectedBuffer")}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/50 p-2 text-terminal-accent">
              {expectedBuffer}
            </pre>
            {!correct && userInput && (
              <>
                <p className="mt-2 text-terminal-dim">{t("yourBuffer")}</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/50 p-2 text-terminal-ko">
                  {userInput}
                </pre>
              </>
            )}
          </details>
        )
      )}

      {explanation && (
        <p className="mt-2 text-terminal-fg/90">{explanation}</p>
      )}
    </div>
  );
}
