import { getDb } from "@/lib/db";

/**
 * Aggregations powering the dashboard. All queries are scoped to a single
 * user. Designed to stay snappy at SQLite scale (sub-100ms for tens of
 * thousands of attempts).
 */

export interface UserTotals {
  totalRuns: number;
  totalAttempts: number;
  correctAttempts: number;
  correctRate: number; // 0-100, integer
  avgTimeMs: number;
}

export function getUserTotals(userId: string): UserTotals {
  const db = getDb();
  const runs = db
    .prepare(
      `SELECT COUNT(*) AS c FROM runs
        WHERE user_id = ? AND ended_at IS NOT NULL`
    )
    .get(userId) as { c: number };
  const att = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
         AVG(time_ms) AS avg_ms
       FROM attempts a
       INNER JOIN runs r ON r.id = a.run_id
       WHERE r.user_id = ?`
    )
    .get(userId) as {
    total: number | null;
    correct: number | null;
    avg_ms: number | null;
  };
  const total = att.total ?? 0;
  const correct = att.correct ?? 0;
  return {
    totalRuns: runs.c,
    totalAttempts: total,
    correctAttempts: correct,
    correctRate: total === 0 ? 0 : Math.round((correct / total) * 100),
    avgTimeMs: att.avg_ms === null ? 0 : Math.round(att.avg_ms)
  };
}

export interface ScorePoint {
  runId: string;
  startedAt: number;
  scorePercent: number;
  totalQuestions: number;
  correctCount: number;
}

export function getScoreCurve(userId: string, limit = 30): ScorePoint[] {
  return (
    getDb()
      .prepare(
        `SELECT id AS runId, started_at AS startedAt,
                score_percent AS scorePercent,
                total_questions AS totalQuestions,
                correct_count AS correctCount
         FROM runs
         WHERE user_id = ? AND ended_at IS NOT NULL
         ORDER BY started_at DESC
         LIMIT ?`
      )
      .all(userId, limit) as ScorePoint[]
  ).reverse(); // oldest → newest for plotting
}

export interface HeatmapCell {
  domain: string;
  difficulty: number;
  total: number;
  correct: number;
}

export function getHeatmap(userId: string): HeatmapCell[] {
  return getDb()
    .prepare(
      `SELECT a.domain AS domain,
              a.difficulty AS difficulty,
              COUNT(*) AS total,
              SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct
       FROM attempts a
       INNER JOIN runs r ON r.id = a.run_id
       WHERE r.user_id = ?
       GROUP BY a.domain, a.difficulty`
    )
    .all(userId) as HeatmapCell[];
}

export interface MissedQuestion {
  questionId: string;
  total: number;
  missed: number;
  missRate: number; // 0-100
}

export function getTopMissed(userId: string, limit = 10): MissedQuestion[] {
  return getDb()
    .prepare(
      `SELECT a.question_id AS questionId,
              COUNT(*) AS total,
              SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) AS missed
       FROM attempts a
       INNER JOIN runs r ON r.id = a.run_id
       WHERE r.user_id = ?
       GROUP BY a.question_id
       HAVING missed > 0
       ORDER BY missed DESC, total DESC
       LIMIT ?`
    )
    .all(userId, limit)
    .map((row) => {
      const r = row as { questionId: string; total: number; missed: number };
      return {
        ...r,
        missRate: r.total === 0 ? 0 : Math.round((r.missed / r.total) * 100)
      };
    });
}

/**
 * Streak = number of consecutive UTC days with at least one ended run, ending
 * today (or yesterday — we don't break the streak until 48h pass without a
 * session).
 */
export function getStreak(userId: string): number {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT date(started_at / 1000, 'unixepoch') AS day
       FROM runs
       WHERE user_id = ? AND ended_at IS NOT NULL
       ORDER BY day DESC`
    )
    .all(userId) as { day: string }[];
  if (rows.length === 0) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const oneDay = 86_400_000;
  const days = new Set(rows.map((r) => r.day));

  // Allow today missing as long as yesterday has activity (the user hasn't
  // played yet today but the streak is still alive).
  let cursor = today.getTime();
  if (!days.has(toYmd(cursor))) cursor -= oneDay;

  let streak = 0;
  while (days.has(toYmd(cursor))) {
    streak++;
    cursor -= oneDay;
  }
  return streak;
}

function toYmd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
