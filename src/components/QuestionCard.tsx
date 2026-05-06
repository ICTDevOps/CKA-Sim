"use client";

import type { Question } from "@/lib/questions";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  hintsRevealed: number;
  onRevealHint: () => void;
}

const DOMAIN_LABEL: Record<string, string> = {
  "cluster-architecture": "Architecture & RBAC",
  "workloads-scheduling": "Workloads & Scheduling",
  "services-networking": "Services & Networking",
  storage: "Storage",
  troubleshooting: "Troubleshooting",
  other: "Autre"
};

export function QuestionCard({
  question,
  index,
  total,
  hintsRevealed,
  onRevealHint
}: QuestionCardProps) {
  const hints = question.hints ?? [];
  return (
    <article className="space-y-3 rounded-lg border border-terminal-dim/40 bg-black/30 p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs text-terminal-dim">
        <span className="rounded bg-terminal-dim/20 px-2 py-0.5">
          Q {index + 1}/{total}
        </span>
        <span>{DOMAIN_LABEL[question.domain] ?? question.domain}</span>
        <span aria-label={`Difficulté ${question.difficulty} sur 5`}>
          {"★".repeat(question.difficulty)}
          <span className="opacity-30">
            {"★".repeat(5 - question.difficulty)}
          </span>
        </span>
        {question.k8sVersion && <span>k8s v{question.k8sVersion}</span>}
      </header>
      <p className="text-base leading-relaxed text-terminal-fg">
        {question.scenario}
      </p>
      {hints.length > 0 && (
        <div className="space-y-1 text-sm">
          {hints.slice(0, hintsRevealed).map((h, i) => (
            <p key={i} className="text-terminal-accent">
              💡 {h}
            </p>
          ))}
          {hintsRevealed < hints.length && (
            <button
              type="button"
              onClick={onRevealHint}
              className="text-xs text-terminal-dim underline hover:text-terminal-fg"
            >
              Révéler un indice ({hintsRevealed}/{hints.length}, pénalité au
              score)
            </button>
          )}
        </div>
      )}
    </article>
  );
}
