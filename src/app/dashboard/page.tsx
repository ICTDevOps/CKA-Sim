import Link from "next/link";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { listUserRuns } from "@/lib/db/repositories/runs";
import {
  getHeatmap,
  getScoreCurve,
  getStreak,
  getTopMissed,
  getUserTotals
} from "@/lib/db/repositories/stats";
import { loadAllQuestions } from "@/lib/questions";
import { ScoreCurve } from "@/components/dashboard/ScoreCurve";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { TopMissed } from "@/components/dashboard/TopMissed";

export const dynamic = "force-dynamic"; // pas de cache : la DB change

export default async function DashboardPage() {
  const userId = await requireLocalUserId();
  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-terminal-dim">
          Cookie de session absent. Recharge la page.
        </p>
      </main>
    );
  }

  const [totals, scoreCurve, heatmap, topMissed, recentRuns] = [
    getUserTotals(userId),
    getScoreCurve(userId, 30),
    getHeatmap(userId),
    getTopMissed(userId, 10),
    listUserRuns(userId, 5)
  ];
  const streak = getStreak(userId);
  const questions = loadAllQuestions();

  if (totals.totalRuns === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold">Dashboard</h1>
        <p className="text-terminal-dim">
          Pas encore de session terminée. Lance-en une et reviens ici pour
          voir ta progression.
        </p>
        <Link
          href="/session"
          className="mt-6 inline-block rounded bg-terminal-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90"
        >
          Démarrer une session
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-terminal-dim">
            Ta progression sur les {totals.totalRuns} dernières sessions.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/session"
            className="rounded bg-terminal-accent px-3 py-2 font-semibold text-terminal-bg hover:opacity-90"
          >
            Nouvelle session
          </Link>
          <a
            href="/api/me/export"
            className="rounded border border-terminal-dim/60 px-3 py-2 hover:border-terminal-fg"
          >
            Exporter
          </a>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sessions" value={totals.totalRuns} />
        <Stat
          label="Taux de réussite"
          value={`${totals.correctRate}%`}
          hint={`${totals.correctAttempts} / ${totals.totalAttempts}`}
        />
        <Stat
          label="Temps moyen"
          value={`${(totals.avgTimeMs / 1000).toFixed(1)}s`}
          hint="par question"
        />
        <Stat
          label="Streak"
          value={`${streak} j`}
          hint={streak >= 2 ? "🔥 continue" : "joue tous les jours"}
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
          Score sur les {scoreCurve.length} dernières sessions
        </h2>
        <ScoreCurve points={scoreCurve} />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
            Performance par domaine × difficulté
          </h2>
          <Heatmap cells={heatmap} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
            Top 10 questions à retravailler
          </h2>
          <TopMissed missed={topMissed} questions={questions} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
          Sessions récentes
        </h2>
        <ul className="divide-y divide-terminal-dim/30 rounded-lg border border-terminal-dim/40 bg-black/30 text-sm">
          {recentRuns.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <span className="text-terminal-dim">
                {new Date(r.started_at).toLocaleString("fr-FR")}
              </span>
              <span>
                {r.correct_count} / {r.total_questions} ·{" "}
                <strong>{r.score_percent}%</strong>
              </span>
              <span className="text-terminal-dim">
                {(r.total_time_ms / 1000).toFixed(0)}s
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-terminal-dim/40 bg-black/30 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-terminal-dim">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-terminal-fg">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-terminal-dim">{hint}</div>
      )}
    </div>
  );
}
