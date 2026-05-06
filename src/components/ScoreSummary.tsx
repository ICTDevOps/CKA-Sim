"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { FinalScore } from "@/lib/session";

interface ScoreSummaryProps {
  score: FinalScore;
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

export function ScoreSummary({ score }: ScoreSummaryProps) {
  const t = useTranslations("score");
  const tDomain = useTranslations("question.domains");

  const verdict =
    score.percent >= 80
      ? t("verdictExcellent")
      : score.percent >= 60
      ? t("verdictGood")
      : t("verdictWork");

  return (
    <section className="space-y-4 rounded-lg border border-terminal-dim/40 bg-black/30 p-6">
      <header>
        <h2 className="text-2xl font-bold text-terminal-fg">
          {t("headline", {
            correct: score.correct,
            total: score.total,
            percent: score.percent
          })}
        </h2>
        <p className="text-terminal-dim">{verdict}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-terminal-dim">{t("totalTime")}</dt>
          <dd className="text-terminal-fg">{fmtTime(score.totalTimeMs)}</dd>
        </div>
        <div>
          <dt className="text-terminal-dim">{t("averageTime")}</dt>
          <dd className="text-terminal-fg">{fmtTime(score.averageTimeMs)}</dd>
        </div>
      </dl>

      {Object.keys(score.perDomain).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-terminal-dim">
            {t("perDomain")}
          </h3>
          <ul className="space-y-1 text-sm">
            {Object.entries(score.perDomain).map(([domain, stats]) => {
              const pct =
                stats.total === 0
                  ? 0
                  : Math.round((stats.correct / stats.total) * 100);
              return (
                <li
                  key={domain}
                  className="flex items-center justify-between gap-3"
                >
                  <span>
                    {tDomain(
                      domain as Parameters<typeof tDomain>[0]
                    )}
                  </span>
                  <span className="tabular-nums text-terminal-dim">
                    {stats.correct}/{stats.total} ({pct}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Link
          href="/session"
          className="rounded bg-terminal-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90"
        >
          {t("replay")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-terminal-dim/60 px-4 py-2 text-sm hover:border-terminal-fg"
        >
          {t("viewDashboard")}
        </Link>
        <Link
          href="/"
          className="rounded border border-terminal-dim/60 px-4 py-2 text-sm hover:border-terminal-fg"
        >
          {t("backHome")}
        </Link>
      </div>
    </section>
  );
}
