import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import type { RunRow } from "@/lib/db/types";

export interface CreateRunInput {
  userId: string;
  mode: "training" | "exam";
  totalQuestions: number;
  categoryFilter?: string | null;
  k8sVersion?: string | null;
}

export function createRun(input: CreateRunInput): RunRow {
  const row: RunRow = {
    id: uuid(),
    user_id: input.userId,
    mode: input.mode,
    category_filter: input.categoryFilter ?? null,
    k8s_version: input.k8sVersion ?? null,
    total_questions: input.totalQuestions,
    correct_count: 0,
    total_time_ms: 0,
    score_percent: 0,
    started_at: Date.now(),
    ended_at: null
  };
  getDb()
    .prepare(
      `INSERT INTO runs (
        id, user_id, mode, category_filter, k8s_version,
        total_questions, correct_count, total_time_ms, score_percent,
        started_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.id,
      row.user_id,
      row.mode,
      row.category_filter,
      row.k8s_version,
      row.total_questions,
      row.correct_count,
      row.total_time_ms,
      row.score_percent,
      row.started_at,
      row.ended_at
    );
  return row;
}

export function getRun(id: string): RunRow | null {
  return (
    (getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as
      | RunRow
      | undefined) ?? null
  );
}

export interface EndRunInput {
  runId: string;
  userId: string;
  correctCount: number;
  totalTimeMs: number;
  scorePercent: number;
}

/**
 * Closes a run by writing aggregate scores. Returns false if the run does
 * not exist, does not belong to the user, or is already closed.
 */
export function endRun(input: EndRunInput): RunRow | null {
  const db = getDb();
  const run = getRun(input.runId);
  if (!run || run.user_id !== input.userId) return null;
  if (run.ended_at !== null) return run;

  const endedAt = Date.now();
  db.prepare(
    `UPDATE runs SET
       correct_count = ?,
       total_time_ms = ?,
       score_percent = ?,
       ended_at = ?
     WHERE id = ?`
  ).run(
    input.correctCount,
    input.totalTimeMs,
    input.scorePercent,
    endedAt,
    input.runId
  );
  return { ...run, ...{
    correct_count: input.correctCount,
    total_time_ms: input.totalTimeMs,
    score_percent: input.scorePercent,
    ended_at: endedAt
  } };
}

export function listUserRuns(userId: string, limit = 30): RunRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM runs
        WHERE user_id = ? AND ended_at IS NOT NULL
        ORDER BY started_at DESC
        LIMIT ?`
    )
    .all(userId, limit) as RunRow[];
}
