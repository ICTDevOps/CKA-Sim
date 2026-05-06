/**
 * Migrations applied in order. Each entry is `{ name, sql }` — the name is
 * the unique key recorded in the `_migrations` table.
 *
 * Add new migrations by appending to this list. Never edit a previously
 * shipped migration: write a new one instead.
 */

export interface Migration {
  name: string;
  sql: string;
}

const M001_INITIAL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT,
  is_anonymous  INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,
  category_filter TEXT,
  k8s_version     TEXT,
  total_questions INTEGER NOT NULL,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  total_time_ms   INTEGER NOT NULL DEFAULT 0,
  score_percent   INTEGER NOT NULL DEFAULT 0,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_runs_user_started
  ON runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS attempts (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  question_id        TEXT NOT NULL,
  category           TEXT NOT NULL,
  domain             TEXT NOT NULL,
  difficulty         INTEGER NOT NULL,
  user_input         TEXT NOT NULL,
  is_correct         INTEGER NOT NULL,
  time_ms            INTEGER NOT NULL,
  hints_used         INTEGER NOT NULL DEFAULT 0,
  keystrokes         INTEGER,
  optimal_keystrokes INTEGER,
  ai_feedback        TEXT,
  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_run      ON attempts(run_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_qid_correct
  ON attempts(question_id, is_correct);
`;

export const MIGRATIONS: Migration[] = [
  { name: "001-initial", sql: M001_INITIAL }
];
