import type { MissedQuestion } from "@/lib/db/repositories/stats";
import type { Question } from "@/lib/questions";
import { localized, type Locale } from "@/lib/questions/types";

interface TopMissedProps {
  missed: MissedQuestion[];
  questions: Question[];
  locale: Locale;
  emptyLabel: string;
}

export function TopMissed({
  missed,
  questions,
  locale,
  emptyLabel
}: TopMissedProps) {
  if (missed.length === 0) {
    return (
      <div className="rounded-lg border border-terminal-dim/40 bg-black/30 p-4 text-sm text-terminal-dim">
        {emptyLabel}
      </div>
    );
  }
  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <ul className="divide-y divide-terminal-dim/30 overflow-hidden rounded-lg border border-terminal-dim/40 bg-black/30 text-sm">
      {missed.map((m) => {
        const q = byId.get(m.questionId);
        return (
          <li key={m.questionId} className="px-4 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-terminal-fg">
                {q ? localized(q.scenario, locale) : m.questionId}
              </span>
              <span className="whitespace-nowrap text-xs tabular-nums text-terminal-ko">
                {m.missed}/{m.total} ({m.missRate}%)
              </span>
            </div>
            {q && (
              <div className="text-xs text-terminal-dim">
                {q.domain} · ★{q.difficulty}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
