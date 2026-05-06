import { v4 as uuid } from "uuid";
import { getDb } from "@/lib/db";
import type { AttemptRow } from "@/lib/db/types";

export interface RecordAttemptInput {
  runId: string;
  userId: string;
  questionId: string;
  category: string;
  domain: string;
  difficulty: number;
  userInput: string;
  isCorrect: boolean;
  timeMs: number;
  hintsUsed: number;
  keystrokes?: number | null;
  optimalKeystrokes?: number | null;
}

/**
 * Records an attempt. Returns null if the parent run does not belong to the
 * user (basic ownership check).
 */
export function recordAttempt(
  input: RecordAttemptInput
): AttemptRow | null {
  const db = getDb();
  const run = db
    .prepare("SELECT user_id FROM runs WHERE id = ?")
    .get(input.runId) as { user_id: string } | undefined;
  if (!run || run.user_id !== input.userId) return null;

  const row: AttemptRow = {
    id: uuid(),
    run_id: input.runId,
    question_id: input.questionId,
    category: input.category,
    domain: input.domain,
    difficulty: input.difficulty,
    user_input: input.userInput,
    is_correct: input.isCorrect ? 1 : 0,
    time_ms: input.timeMs,
    hints_used: input.hintsUsed,
    keystrokes: input.keystrokes ?? null,
    optimal_keystrokes: input.optimalKeystrokes ?? null,
    ai_feedback: null,
    created_at: Date.now()
  };
  db.prepare(
    `INSERT INTO attempts (
      id, run_id, question_id, category, domain, difficulty,
      user_input, is_correct, time_ms, hints_used,
      keystrokes, optimal_keystrokes, ai_feedback, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.run_id,
    row.question_id,
    row.category,
    row.domain,
    row.difficulty,
    row.user_input,
    row.is_correct,
    row.time_ms,
    row.hints_used,
    row.keystrokes,
    row.optimal_keystrokes,
    row.ai_feedback,
    row.created_at
  );
  return row;
}

export function listRunAttempts(
  runId: string,
  userId: string
): AttemptRow[] {
  return getDb()
    .prepare(
      `SELECT a.* FROM attempts a
       INNER JOIN runs r ON r.id = a.run_id
       WHERE a.run_id = ? AND r.user_id = ?
       ORDER BY a.created_at ASC`
    )
    .all(runId, userId) as AttemptRow[];
}

export function listUserAttempts(userId: string): AttemptRow[] {
  return getDb()
    .prepare(
      `SELECT a.* FROM attempts a
       INNER JOIN runs r ON r.id = a.run_id
       WHERE r.user_id = ?
       ORDER BY a.created_at DESC`
    )
    .all(userId) as AttemptRow[];
}
