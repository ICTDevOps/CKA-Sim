import type { Question } from "@/lib/questions/types";
import { dispatchValidator } from "@/lib/validators";
import type {
  AttemptRecord,
  FinalScore,
  SessionConfig,
  SessionState
} from "./types";

/**
 * Moteur de session pur (sans I/O ni React). Toutes les transitions sont
 * exprimées comme des fonctions `(state, event) => state`. Cela rend le
 * comportement testable indépendamment de l'UI et permet de brancher plus tard
 * un store (Zustand, Redux, ou un simple useReducer).
 */

export function createSession(
  questions: Question[],
  config: SessionConfig
): SessionState {
  if (questions.length === 0) {
    throw new Error("Une session doit contenir au moins une question.");
  }
  return {
    status: "ready",
    config,
    questions,
    currentIndex: 0,
    attempts: [],
    currentQuestionStartedAt: null,
    hintsRevealed: 0
  };
}

export function startSession(
  state: SessionState,
  now: number = Date.now()
): SessionState {
  if (state.status !== "ready") return state;
  return {
    ...state,
    status: "playing",
    currentQuestionStartedAt: now
  };
}

export function revealHint(state: SessionState): SessionState {
  if (state.status !== "playing") return state;
  const question = currentQuestion(state);
  // Le nombre d'indices est le même dans toutes les locales par invariant
  // de schéma ; on prend `en` comme référence sans dépendre de la locale.
  const max = question.hints?.en.length ?? 0;
  if (state.hintsRevealed >= max) return state;
  return { ...state, hintsRevealed: state.hintsRevealed + 1 };
}

export interface SubmitOptions {
  now?: number;
  /** vi-only: number of keystrokes recorded during the question. */
  keystrokes?: number;
}

/**
 * Soumet la réponse de l'utilisateur pour la question courante.
 * Le moteur ne valide pas les inputs vides : c'est à l'UI de les bloquer.
 *
 * Pour les questions vi, l'UI passe le `keystrokes` mesuré ; on récupère
 * `optimalKeystrokes` depuis la définition de la question pour calculer
 * l'efficacité côté client/dashboard.
 */
export function submitAnswer(
  state: SessionState,
  input: string,
  opts: SubmitOptions = {}
): SessionState {
  if (state.status !== "playing") return state;
  const now = opts.now ?? Date.now();
  const question = currentQuestion(state);
  const result = dispatchValidator.validate(input, question);
  const startedAt = state.currentQuestionStartedAt ?? now;
  const isVi = question.challenge.type === "vi";
  const attempt: AttemptRecord = {
    questionId: question.id,
    userInput: input,
    correct: result.correct,
    hintsUsed: state.hintsRevealed,
    timeMs: Math.max(0, now - startedAt),
    submittedAt: now,
    ...(isVi
      ? {
          keystrokes: opts.keystrokes,
          optimalKeystrokes:
            question.challenge.type === "vi"
              ? question.challenge.optimalKeystrokes
              : undefined
        }
      : {})
  };
  const nextIndex = state.currentIndex + 1;
  const finished = nextIndex >= state.config.totalQuestions
    || nextIndex >= state.questions.length;
  return {
    ...state,
    attempts: [...state.attempts, attempt],
    currentIndex: finished ? state.currentIndex : nextIndex,
    status: finished ? "finished" : "playing",
    currentQuestionStartedAt: finished ? null : now,
    hintsRevealed: 0
  };
}

/**
 * Marque la question courante comme abandonnée (timeout, ou bouton "skip").
 */
export function skipQuestion(
  state: SessionState,
  now: number = Date.now()
): SessionState {
  return submitAnswer(state, "", { now });
}

export function currentQuestion(state: SessionState): Question {
  return state.questions[state.currentIndex];
}

export function computeFinalScore(state: SessionState): FinalScore {
  const total = state.attempts.length;
  const correct = state.attempts.filter((a) => a.correct).length;
  const totalTimeMs = state.attempts.reduce((acc, a) => acc + a.timeMs, 0);
  const perDomain: FinalScore["perDomain"] = {};
  for (const a of state.attempts) {
    const q = state.questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    const slot = perDomain[q.domain] ?? { total: 0, correct: 0 };
    slot.total += 1;
    if (a.correct) slot.correct += 1;
    perDomain[q.domain] = slot;
  }
  return {
    total,
    correct,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    totalTimeMs,
    averageTimeMs: total === 0 ? 0 : Math.round(totalTimeMs / total),
    perDomain
  };
}
