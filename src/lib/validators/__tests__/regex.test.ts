import { describe, expect, it } from "vitest";
import { RegexValidator } from "@/lib/validators/regex";
import type { CommandQuestion } from "@/lib/questions/types";

const validator = new RegexValidator();

function cmd(
  patterns: string[],
  expected = "kubectl get pods"
): CommandQuestion {
  return {
    id: "test",
    category: "kubectl",
    domain: "workloads-scheduling",
    scenario: { en: "test", fr: "test" },
    difficulty: 1,
    challenge: {
      type: "command",
      expected,
      acceptedPatterns: patterns
    }
  };
}

describe("RegexValidator", () => {
  it("accepts a matching pattern", () => {
    const r = validator.validate(
      "kubectl get pods",
      cmd(["^kubectl\\s+get\\s+pods?$"])
    );
    expect(r.correct).toBe(true);
    expect(r.matchedPattern).toBeDefined();
  });

  it("rejects a non-matching input", () => {
    const r = validator.validate(
      "kubectl describe pods",
      cmd(["^kubectl\\s+get\\s+pods?$"])
    );
    expect(r.correct).toBe(false);
  });

  it("rejects empty input with a note", () => {
    const r = validator.validate("", cmd(["^anything$"]));
    expect(r.correct).toBe(false);
    expect(r.notes).toContain("Saisie vide.");
  });

  it("normalizes multiple spaces", () => {
    const r = validator.validate(
      "kubectl    get    pods",
      cmd(["^kubectl get pods$"])
    );
    expect(r.correct).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const r = validator.validate(
      "   kubectl get pods   ",
      cmd(["^kubectl get pods$"])
    );
    expect(r.correct).toBe(true);
  });

  it("is case-insensitive on flags but anchored", () => {
    const r = validator.validate(
      "KUBECTL GET PODS",
      cmd(["^kubectl get pods$"])
    );
    expect(r.correct).toBe(true);
    // Anchored patterns prevent shell injection-style appends.
    const r2 = validator.validate(
      "kubectl get pods && rm -rf /",
      cmd(["^kubectl get pods$"])
    );
    expect(r2.correct).toBe(false);
  });

  it("accepts as soon as one of N patterns matches", () => {
    const q = cmd([
      "^impossible$",
      "^kubectl\\s+get\\s+(pods?|po)\\s+-n\\s+web$"
    ]);
    expect(
      validator.validate("kubectl get po -n web", q).correct
    ).toBe(true);
  });

  it("ignores invalid regex patterns gracefully", () => {
    // The first pattern is malformed; the validator should skip it and
    // still try the second.
    const q = cmd(["[unclosed", "^kubectl\\s+get$"]);
    expect(validator.validate("kubectl get", q).correct).toBe(true);
  });

  it("refuses to validate vi questions (wrong validator)", () => {
    const viQ = {
      id: "v",
      category: "vi" as const,
      domain: "other" as const,
      scenario: { en: "x", fr: "x" },
      difficulty: 1 as const,
      challenge: {
        type: "vi" as const,
        initialBuffer: "a",
        expectedBuffer: "a"
      }
    };
    const r = validator.validate("anything", viQ);
    expect(r.correct).toBe(false);
    expect(r.notes?.[0]).toMatch(/RegexValidator/);
  });
});
