"use client";

import { useLocale, useTranslations } from "next-intl";
import { localized, localizedArray, type Locale } from "@/lib/questions/types";
import type { Question } from "@/lib/questions";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  hintsRevealed: number;
  onRevealHint: () => void;
}

export function QuestionCard({
  question,
  index,
  total,
  hintsRevealed,
  onRevealHint
}: QuestionCardProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("question");
  const tDomain = useTranslations("question.domains");

  const hints = localizedArray(question.hints, locale);
  const scenario = localized(question.scenario, locale);

  return (
    <article className="space-y-3 rounded-lg border border-terminal-dim/40 bg-black/30 p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs text-terminal-dim">
        <span className="rounded bg-terminal-dim/20 px-2 py-0.5">
          {t("indexLabel", { index: index + 1, total })}
        </span>
        <span>{tDomain(question.domain)}</span>
        <span aria-label={t("difficultyAria", { n: question.difficulty })}>
          {"★".repeat(question.difficulty)}
          <span className="opacity-30">
            {"★".repeat(5 - question.difficulty)}
          </span>
        </span>
        {question.k8sVersion && (
          <span>{t("k8sVersion", { version: question.k8sVersion })}</span>
        )}
      </header>
      <p className="text-base leading-relaxed text-terminal-fg">
        {scenario}
      </p>
      {hints.length > 0 && (
        <div className="space-y-1 text-sm">
          {hints.slice(0, hintsRevealed).map((h, i) => (
            <p key={i} className="text-terminal-accent">
              {t("hintIcon")} {h}
            </p>
          ))}
          {hintsRevealed < hints.length && (
            <button
              type="button"
              onClick={onRevealHint}
              className="text-xs text-terminal-dim underline hover:text-terminal-fg"
            >
              {t("revealHint", {
                revealed: hintsRevealed,
                total: hints.length
              })}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
