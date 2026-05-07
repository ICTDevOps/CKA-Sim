import { describe, expect, it } from "vitest";
import {
  computeFinalScore,
  createSession,
  currentQuestion,
  revealHint,
  skipQuestion,
  startSession,
  submitAnswer
} from "@/lib/session";
import type {
  CommandQuestion,
  Question,
  ViQuestion
} from "@/lib/questions/types";

function cmd(
  id: string,
  expected: string,
  patterns: string[] = []
): CommandQuestion {
  return {
    id,
    category: "kubectl",
    domain: "workloads-scheduling",
    scenario: { en: id, fr: id },
    difficulty: 1,
    hints: { en: ["hint 1", "hint 2"], fr: ["indice 1", "indice 2"] },
    challenge: {
      type: "command",
      expected,
      acceptedPatterns: patterns.length ? patterns : [`^${expected}$`]
    }
  };
}

function viQ(id: string): ViQuestion {
  return {
    id,
    category: "vi",
    domain: "other",
    scenario: { en: id, fr: id },
    difficulty: 1,
    challenge: {
      type: "vi",
      initialBuffer: "a",
      expectedBuffer: "b",
      optimalKeystrokes: 7
    }
  };
}

const seed: Question[] = [cmd("q1", "k get pods"), cmd("q2", "k get nodes")];
const config = { totalQuestions: 2, perQuestionTimeLimitSec: 60 };

describe("session engine", () => {
  it("starts in 'ready' and transitions to 'playing'", () => {
    const s0 = createSession(seed, config);
    expect(s0.status).toBe("ready");
    const s1 = startSession(s0, 1000);
    expect(s1.status).toBe("playing");
    expect(s1.currentQuestionStartedAt).toBe(1000);
  });

  it("records correct/incorrect attempts and advances", () => {
    const s = startSession(createSession(seed, config), 1000);
    const s1 = submitAnswer(s, "k get pods", { now: 2000 });
    expect(s1.status).toBe("playing");
    expect(s1.currentIndex).toBe(1);
    expect(s1.attempts).toHaveLength(1);
    expect(s1.attempts[0].correct).toBe(true);
    expect(s1.attempts[0].timeMs).toBe(1000);

    const s2 = submitAnswer(s1, "wrong", { now: 4000 });
    expect(s2.status).toBe("finished");
    expect(s2.attempts).toHaveLength(2);
    expect(s2.attempts[1].correct).toBe(false);
  });

  it("treats skipQuestion as an empty submit", () => {
    const s = startSession(createSession(seed, config));
    const s1 = skipQuestion(s);
    expect(s1.attempts).toHaveLength(1);
    expect(s1.attempts[0].correct).toBe(false);
    expect(s1.attempts[0].userInput).toBe("");
  });

  it("revealHint increments hintsRevealed up to the question's hint count", () => {
    const s = startSession(createSession(seed, config));
    expect(currentQuestion(s).hints?.en).toHaveLength(2);
    const s1 = revealHint(s);
    expect(s1.hintsRevealed).toBe(1);
    const s2 = revealHint(s1);
    expect(s2.hintsRevealed).toBe(2);
    // Capped at the total number of hints.
    const s3 = revealHint(s2);
    expect(s3.hintsRevealed).toBe(2);
  });

  it("threads vi keystrokes through the AttemptRecord", () => {
    const s = startSession(createSession([viQ("v1")], { ...config, totalQuestions: 1 }));
    const s1 = submitAnswer(s, "b", { now: Date.now(), keystrokes: 9 });
    expect(s1.attempts[0].keystrokes).toBe(9);
    expect(s1.attempts[0].optimalKeystrokes).toBe(7);
    expect(s1.attempts[0].correct).toBe(true);
  });

  it("computeFinalScore aggregates per domain", () => {
    const s = startSession(createSession(seed, config), 0);
    const s1 = submitAnswer(s, "k get pods", { now: 1500 });
    const s2 = submitAnswer(s1, "wrong", { now: 3000 });
    const score = computeFinalScore(s2);
    expect(score.total).toBe(2);
    expect(score.correct).toBe(1);
    expect(score.percent).toBe(50);
    expect(score.totalTimeMs).toBe(3000);
    expect(score.averageTimeMs).toBe(1500);
    expect(score.perDomain["workloads-scheduling"]).toEqual({
      total: 2,
      correct: 1
    });
  });

  it("ignores submitAnswer when not playing", () => {
    const s = createSession(seed, config); // still 'ready'
    expect(submitAnswer(s, "anything")).toBe(s);
  });
});
