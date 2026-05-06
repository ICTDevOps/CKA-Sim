"use client";

import Link from "next/link";
import type { FinalScore } from "@/lib/session";

const DOMAIN_LABEL: Record<string, string> = {
  "cluster-architecture": "Architecture & RBAC",
  "workloads-scheduling": "Workloads & Scheduling",
  "services-networking": "Services & Networking",
  storage: "Storage",
  troubleshooting: "Troubleshooting",
  other: "Autre"
};

interface ScoreSummaryProps {
  score: FinalScore;
}

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

export function ScoreSummary({ score }: ScoreSummaryProps) {
  const verdict =
    score.percent >= 80
      ? "Excellent — tu es prêt pour ce style de question."
      : score.percent >= 60
      ? "Pas mal. Quelques zones à retravailler."
      : "Il y a du chemin, mais c'est pour ça que tu t'entraînes.";

  return (
    <section className="space-y-4 rounded-lg border border-terminal-dim/40 bg-black/30 p-6">
      <header>
        <h2 className="text-2xl font-bold text-terminal-fg">
          Score : {score.correct} / {score.total} ({score.percent}%)
        </h2>
        <p className="text-terminal-dim">{verdict}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-terminal-dim">Temps total</dt>
          <dd className="text-terminal-fg">{fmtTime(score.totalTimeMs)}</dd>
        </div>
        <div>
          <dt className="text-terminal-dim">Temps moyen / question</dt>
          <dd className="text-terminal-fg">{fmtTime(score.averageTimeMs)}</dd>
        </div>
      </dl>

      {Object.keys(score.perDomain).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-terminal-dim">
            Performance par domaine
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
                  <span>{DOMAIN_LABEL[domain] ?? domain}</span>
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
          Rejouer
        </Link>
        <Link
          href="/"
          className="rounded border border-terminal-dim/60 px-4 py-2 text-sm hover:border-terminal-fg"
        >
          Retour à l'accueil
        </Link>
      </div>
    </section>
  );
}
