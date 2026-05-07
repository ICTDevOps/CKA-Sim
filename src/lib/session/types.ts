import type { Question } from "@/lib/questions/types";

export type SessionStatus = "ready" | "playing" | "finished";

export interface AttemptRecord {
  questionId: string;
  userInput: string;
  correct: boolean;
  hintsUsed: number;
  timeMs: number;
  /** Timestamp d'envoi de la réponse (epoch ms). */
  submittedAt: number;
  /** vi-only: keystrokes the user actually pressed during the question. */
  keystrokes?: number;
  /** vi-only: optimal keystroke count from the question definition. */
  optimalKeystrokes?: number;
}

export interface SessionConfig {
  /** Nombre total de questions de la session. */
  totalQuestions: number;
  /** Limite de temps par question, en secondes. 0 = pas de limite. */
  perQuestionTimeLimitSec: number;
  /** Seed déterministe pour rejouer une session identique. */
  seed?: number;
}

export interface SessionState {
  status: SessionStatus;
  config: SessionConfig;
  questions: Question[];
  /** Index de la question courante (0-based). */
  currentIndex: number;
  /** Tentatives déjà soumises. */
  attempts: AttemptRecord[];
  /** Timestamp de début de la question courante (pour mesurer le temps). */
  currentQuestionStartedAt: number | null;
  /** Indices révélés pour la question courante. */
  hintsRevealed: number;
}

export interface FinalScore {
  total: number;
  correct: number;
  /** Pourcentage 0-100 (entier). */
  percent: number;
  totalTimeMs: number;
  averageTimeMs: number;
  /** Détail par domaine CKA, pour identifier les points faibles. */
  perDomain: Record<string, { total: number; correct: number }>;
}
