import { describe, expect, it } from "vitest";
import { ViValidator } from "@/lib/validators/vi";
import type { ViQuestion } from "@/lib/questions/types";

const validator = new ViValidator();

function vi(expected: string | string[], initial = "x"): ViQuestion {
  return {
    id: "v",
    category: "vi",
    domain: "other",
    scenario: { en: "x", fr: "x" },
    difficulty: 1,
    challenge: {
      type: "vi",
      initialBuffer: initial,
      expectedBuffer: expected
    }
  };
}

describe("ViValidator", () => {
  it("accepts an exact match", () => {
    expect(validator.validate("a\nb\n", vi("a\nb\n")).correct).toBe(true);
  });

  it("normalizes CRLF to LF before comparing", () => {
    expect(
      validator.validate("a\r\nb\r\n", vi("a\nb\n")).correct
    ).toBe(true);
  });

  it("accepts any of multiple expected targets", () => {
    const r = validator.validate(
      "shorter",
      vi(["never", "shorter", "longer"])
    );
    expect(r.correct).toBe(true);
  });

  it("tolerates trailing newline differences with a note", () => {
    const r = validator.validate("foo\nbar", vi("foo\nbar\n"));
    expect(r.correct).toBe(true);
    expect(r.notes?.[0]).toMatch(/trailing newlines/i);
  });

  it("does not tolerate inner-line whitespace differences", () => {
    expect(validator.validate("a b", vi("a  b")).correct).toBe(false);
  });

  it("rejects on content mismatch", () => {
    expect(validator.validate("foo", vi("bar")).correct).toBe(false);
  });

  it("refuses to validate command questions", () => {
    const cmdQ = {
      id: "c",
      category: "kubectl" as const,
      domain: "other" as const,
      scenario: { en: "x", fr: "x" },
      difficulty: 1 as const,
      challenge: {
        type: "command" as const,
        expected: "k",
        acceptedPatterns: ["^k$"]
      }
    };
    const r = validator.validate("k", cmdQ);
    expect(r.correct).toBe(false);
    expect(r.notes?.[0]).toMatch(/non-vi question/);
  });
});
