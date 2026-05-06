"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Feedback } from "@/components/Feedback";
import { Prompt, type PromptHandle } from "@/components/Prompt";
import { QuestionCard } from "@/components/QuestionCard";
import { ScoreSummary } from "@/components/ScoreSummary";
import { Timer } from "@/components/Timer";
import { loadAllQuestions, shuffle } from "@/lib/questions";
import {
  computeFinalScore,
  createSession,
  currentQuestion,
  revealHint,
  skipQuestion,
  startSession,
  submitAnswer,
  type SessionState
} from "@/lib/session";

const TOTAL_QUESTIONS = 10;
const PER_QUESTION_LIMIT_SEC = 60;

export default function SessionPage() {
  const initial = useMemo<SessionState>(() => {
    const all = loadAllQuestions();
    const picked = shuffle(all).slice(
      0,
      Math.min(TOTAL_QUESTIONS, all.length)
    );
    return createSession(picked, {
      totalQuestions: picked.length,
      perQuestionTimeLimitSec: PER_QUESTION_LIMIT_SEC
    });
  }, []);

  const [state, setState] = useState<SessionState>(initial);
  const [input, setInput] = useState("");
  const [showFeedback, setShowFeedback] = useState<{
    correct: boolean;
    userInput: string;
    questionId: string;
  } | null>(null);
  const promptRef = useRef<PromptHandle>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Démarrage automatique de la session au mount.
  useEffect(() => {
    setState((s) => (s.status === "ready" ? startSession(s) : s));
  }, []);

  // Cleanup du timeout d'avance si on démonte la page.
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  if (state.status === "finished") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <ScoreSummary score={computeFinalScore(state)} />
      </main>
    );
  }

  const q = currentQuestion(state);

  function handleSubmit(rawInput: string) {
    if (showFeedback) return; // évite double submit pendant l'affichage feedback
    const before = state;
    const after = submitAnswer(before, rawInput);
    const lastAttempt = after.attempts[after.attempts.length - 1];
    setShowFeedback({
      correct: lastAttempt.correct,
      userInput: lastAttempt.userInput,
      questionId: lastAttempt.questionId
    });
    // On affiche le feedback ~2s avant d'avancer, sauf si la session est finie.
    advanceTimerRef.current = setTimeout(() => {
      setState(after);
      setShowFeedback(null);
      setInput("");
      promptRef.current?.focus();
    }, 1800);
  }

  function handleSkip() {
    if (showFeedback) return;
    const after = skipQuestion(state);
    setState(after);
    setShowFeedback(null);
    setInput("");
    promptRef.current?.focus();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-terminal-dim hover:underline">
          ← Quitter
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-terminal-dim">
            {state.attempts.filter((a) => a.correct).length} ✓ ·{" "}
            {state.attempts.length - state.attempts.filter((a) => a.correct).length}{" "}
            ✗
          </span>
          <Timer
            startedAt={state.currentQuestionStartedAt}
            limitSec={state.config.perQuestionTimeLimitSec}
            onTimeout={() => !showFeedback && handleSubmit(input)}
          />
        </div>
      </header>

      <div className="space-y-4">
        <QuestionCard
          question={q}
          index={state.currentIndex}
          total={state.config.totalQuestions}
          hintsRevealed={state.hintsRevealed}
          onRevealHint={() => setState(revealHint(state))}
        />

        <Prompt
          ref={promptRef}
          value={input}
          disabled={!!showFeedback}
          onChange={setInput}
          onSubmit={() => handleSubmit(input)}
        />

        <div className="flex items-center justify-between text-xs text-terminal-dim">
          <span>
            Entrée pour valider · Échap-équivalent : bouton « Passer »
          </span>
          <button
            type="button"
            onClick={handleSkip}
            disabled={!!showFeedback}
            className="rounded border border-terminal-dim/40 px-3 py-1 hover:border-terminal-fg disabled:opacity-40"
          >
            Passer
          </button>
        </div>

        {showFeedback && (
          <Feedback
            question={q}
            correct={showFeedback.correct}
            userInput={showFeedback.userInput}
          />
        )}
      </div>
    </main>
  );
}
