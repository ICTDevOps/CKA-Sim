"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Feedback } from "@/components/Feedback";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Prompt, type PromptHandle } from "@/components/Prompt";
import { QuestionCard } from "@/components/QuestionCard";
import { ScoreSummary } from "@/components/ScoreSummary";
import { Timer } from "@/components/Timer";
import { TutorPanel } from "@/components/TutorPanel";
import { Link } from "@/i18n/navigation";
import { loadAllQuestions, shuffle } from "@/lib/questions";
import type { Question, Locale } from "@/lib/questions/types";
import {
  computeFinalScore,
  createSession,
  currentQuestion,
  revealHint,
  skipQuestion,
  startSession,
  submitAnswer,
  type AttemptRecord,
  type SessionState
} from "@/lib/session";

const TOTAL_QUESTIONS = 10;
const PER_QUESTION_LIMIT_SEC = 60;
const AUTO_ADVANCE_MS = 1800;

interface SessionPrefs {
  aiTutorEnabled: boolean;
  examMode: boolean;
}

export default function SessionPage() {
  const t = useTranslations("session");
  const tTutor = useTranslations("tutor");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

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
    triggerKey: number;
  } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<SessionPrefs>({
    aiTutorEnabled: false,
    examMode: false
  });
  const promptRef = useRef<PromptHandle>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNextStateRef = useRef<SessionState | null>(null);
  const triggerCounter = useRef(0);
  const endedRef = useRef(false);

  // Fetch user prefs once: drives whether the tutor fires after each answer.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { prefs: SessionPrefs }) =>
        setPrefs({
          aiTutorEnabled: d.prefs.aiTutorEnabled,
          examMode: d.prefs.examMode
        })
      )
      .catch((e) => console.warn("[cka-sim] load prefs failed:", e));
  }, []);

  // Start the session + create a server-side run record on mount.
  useEffect(() => {
    setState((s) => (s.status === "ready" ? startSession(s) : s));
    fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: prefs.examMode ? "exam" : "training",
        totalQuestions: initial.config.totalQuestions,
        k8sVersion: "1.31"
      })
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { runId: string }) => setRunId(data.runId))
      .catch((e) => console.warn("[cka-sim] create run failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.config.totalQuestions]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state.status !== "finished" || !runId || endedRef.current) return;
    endedRef.current = true;
    const final = computeFinalScore(state);
    fetch(`/api/runs/${runId}/end`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correctCount: final.correct,
        totalTimeMs: final.totalTimeMs,
        scorePercent: final.percent
      })
    }).catch((e) => console.warn("[cka-sim] end run failed:", e));
  }, [state, runId]);

  if (state.status === "finished") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <ScoreSummary score={computeFinalScore(state)} />
      </main>
    );
  }

  const q = currentQuestion(state);
  const tutorActive = prefs.aiTutorEnabled && !prefs.examMode;

  function postAttempt(question: Question, attempt: AttemptRecord) {
    if (!runId) return;
    fetch(`/api/runs/${runId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        category: question.category,
        domain: question.domain,
        difficulty: question.difficulty,
        userInput: attempt.userInput,
        isCorrect: attempt.correct,
        timeMs: attempt.timeMs,
        hintsUsed: attempt.hintsUsed
      })
    }).catch((e) => console.warn("[cka-sim] record attempt failed:", e));
  }

  function advance(after: SessionState) {
    setState(after);
    setShowFeedback(null);
    setInput("");
    promptRef.current?.focus();
  }

  function handleSubmit(rawInput: string) {
    if (showFeedback) return;
    const questionAtSubmit = currentQuestion(state);
    const after = submitAnswer(state, rawInput);
    const lastAttempt = after.attempts[after.attempts.length - 1];
    postAttempt(questionAtSubmit, lastAttempt);
    triggerCounter.current += 1;
    setShowFeedback({
      correct: lastAttempt.correct,
      userInput: lastAttempt.userInput,
      questionId: lastAttempt.questionId,
      triggerKey: triggerCounter.current
    });
    // Remember the post-submit state so manual Next can apply it without
    // re-running the engine (which would create a duplicate attempt).
    pendingNextStateRef.current = after;
    // In exam mode (or with the tutor off), auto-advance like before. With
    // the tutor on, the user controls the pace via the Next button so they
    // have time to read the streamed explanation.
    if (!tutorActive) {
      advanceTimerRef.current = setTimeout(
        () => advance(after),
        AUTO_ADVANCE_MS
      );
    }
  }

  function handleSkip() {
    if (showFeedback) return;
    const questionAtSubmit = currentQuestion(state);
    const after = skipQuestion(state);
    const lastAttempt = after.attempts[after.attempts.length - 1];
    postAttempt(questionAtSubmit, lastAttempt);
    advance(after);
  }

  function handleNext() {
    if (!showFeedback) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const after = pendingNextStateRef.current;
    pendingNextStateRef.current = null;
    if (after) advance(after);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-terminal-dim hover:underline">
          ← {tCommon("exit")}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-terminal-dim">
            {t("scoreboard", {
              correct: state.attempts.filter((a) => a.correct).length,
              wrong:
                state.attempts.length -
                state.attempts.filter((a) => a.correct).length
            })}
          </span>
          <Timer
            startedAt={state.currentQuestionStartedAt}
            limitSec={state.config.perQuestionTimeLimitSec}
            onTimeout={() => !showFeedback && handleSubmit(input)}
          />
          <LocaleSwitcher />
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
          <span>{t("submitHint")}</span>
          <button
            type="button"
            onClick={handleSkip}
            disabled={!!showFeedback}
            className="rounded border border-terminal-dim/40 px-3 py-1 hover:border-terminal-fg disabled:opacity-40"
          >
            {t("skip")}
          </button>
        </div>

        {showFeedback && (
          <>
            <Feedback
              question={q}
              correct={showFeedback.correct}
              userInput={showFeedback.userInput}
            />
            {tutorActive && (
              <TutorPanel
                question={q}
                userInput={showFeedback.userInput}
                isCorrect={showFeedback.correct}
                locale={locale}
                triggerKey={showFeedback.triggerKey}
              />
            )}
            {tutorActive && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded bg-terminal-accent px-4 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90"
                >
                  {tTutor("next")} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
