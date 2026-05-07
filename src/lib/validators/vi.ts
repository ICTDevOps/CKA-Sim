import type { Question } from "@/lib/questions/types";
import type { Validator, ValidationResult } from "./types";

/**
 * Validates a vi question by comparing the user's final buffer to the
 * expected buffer (or one of several expected buffers, when the question
 * accepts multiple valid end states — e.g. trailing-newline tolerance).
 *
 * The comparison normalizes line endings (CRLF → LF) but keeps whitespace
 * inside lines significant. Indentation matters in YAML, so it should
 * matter here too.
 */
export class ViValidator implements Validator {
  validate(input: string, question: Question): ValidationResult {
    if (question.challenge.type !== "vi") {
      return {
        correct: false,
        notes: ["ViValidator received a non-vi question."]
      };
    }
    const got = normalize(input);
    const expectedRaw = question.challenge.expectedBuffer;
    const targets = (
      Array.isArray(expectedRaw) ? expectedRaw : [expectedRaw]
    ).map(normalize);

    if (targets.some((t) => t === got)) {
      return { correct: true };
    }

    // Tolerate a single trailing newline difference — common YAML editing
    // artifact that doesn't change semantics.
    if (
      targets.some(
        (t) =>
          t.replace(/\n+$/, "") === got.replace(/\n+$/, "")
      )
    ) {
      return {
        correct: true,
        notes: ["Accepted: trailing newlines differ."]
      };
    }

    return { correct: false };
  }
}

export const viValidator = new ViValidator();

function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n");
}
