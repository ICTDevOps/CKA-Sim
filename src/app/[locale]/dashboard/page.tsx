import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { ScoreCurve } from "@/components/dashboard/ScoreCurve";
import { TopMissed } from "@/components/dashboard/TopMissed";
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

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const activeLocale = await getLocale();
  const t = await getTranslations("dashboard");
  const tStats = await getTranslations("dashboard.stats");

  const userId = await requireLocalUserId();
  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-terminal-dim">
          Cookie missing. Reload the page.
        </p>
      </main>
    );
  }

  const totals = getUserTotals(userId);
  const scoreCurve = getScoreCurve(userId, 30);
  const heatmap = getHeatmap(userId);
  const topMissed = getTopMissed(userId, 10);
  const recentRuns = listUserRuns(userId, 5);
  const streak = getStreak(userId);
  const questions = loadAllQuestions();

  if (totals.totalRuns === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <LocaleSwitcher />
        </header>
        <p className="text-terminal-dim">{t("empty")}</p>
        <Link
          href="/session"
          className="mt-6 inline-block rounded bg-terminal-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90"
        >
          {t("newSession")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-sm text-terminal-dim">
            {t("subtitle", { count: totals.totalRuns })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/session"
            className="rounded bg-terminal-accent px-3 py-2 font-semibold text-terminal-bg hover:opacity-90"
          >
            {t("newSession")}
          </Link>
          <a
            href="/api/me/export"
            className="rounded border border-terminal-dim/60 px-3 py-2 hover:border-terminal-fg"
          >
            {t("exportData")}
          </a>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={tStats("sessions")} value={totals.totalRuns} />
        <Stat
          label={tStats("correctRate")}
          value={`${totals.correctRate}%`}
          hint={`${totals.correctAttempts} / ${totals.totalAttempts}`}
        />
        <Stat
          label={tStats("averageTime")}
          value={`${(totals.avgTimeMs / 1000).toFixed(1)}s`}
          hint={tStats("perQuestion")}
        />
        <Stat
          label={tStats("streak")}
          value={tStats("streakDays", { n: streak })}
          hint={
            streak >= 2 ? tStats("streakKeep") : tStats("streakStart")
          }
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
          {t("scoreCurveTitle", { count: scoreCurve.length })}
        </h2>
        <ScoreCurve points={scoreCurve} emptyLabel={t("scoreCurveEmpty")} />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
            {t("heatmapTitle")}
          </h2>
          <Heatmap cells={heatmap} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
            {t("topMissedTitle")}
          </h2>
          <TopMissed
            missed={topMissed}
            questions={questions}
            locale={activeLocale as "en" | "fr"}
            emptyLabel={t("topMissedEmpty")}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-terminal-dim">
          {t("recentTitle")}
        </h2>
        <ul className="divide-y divide-terminal-dim/30 rounded-lg border border-terminal-dim/40 bg-black/30 text-sm">
          {recentRuns.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-2"
            >
              <span className="text-terminal-dim">
                {new Date(r.started_at).toLocaleString(
                  activeLocale === "fr" ? "fr-FR" : "en-US"
                )}
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
      {hint && <div className="text-xs text-terminal-dim">{hint}</div>}
    </div>
  );
}
