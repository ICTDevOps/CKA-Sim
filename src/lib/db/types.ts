/**
 * Row types matching the SQLite schema. Booleans are stored as 0/1.
 */

export interface UserRow {
  id: string;
  display_name: string | null;
  is_anonymous: 0 | 1;
  created_at: number;
}

export interface RunRow {
  id: string;
  user_id: string;
  mode: "training" | "exam";
  category_filter: string | null;
  k8s_version: string | null;
  total_questions: number;
  correct_count: number;
  total_time_ms: number;
  score_percent: number;
  started_at: number;
  ended_at: number | null;
}

export interface AttemptRow {
  id: string;
  run_id: string;
  question_id: string;
  category: string;
  domain: string;
  difficulty: number;
  user_input: string;
  is_correct: 0 | 1;
  time_ms: number;
  hints_used: number;
  keystrokes: number | null;
  optimal_keystrokes: number | null;
  ai_feedback: string | null;
  created_at: number;
}
