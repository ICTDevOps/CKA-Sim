import type { Question } from "@/lib/questions/types";
import { regexValidator } from "./regex";
import type { Validator, ValidationResult } from "./types";
import { viValidator } from "./vi";

/**
 * Dispatch validator: picks the right concrete implementation based on the
 * question's challenge type. Keeps the engine ignorant of validator details.
 */
export class DispatchValidator implements Validator {
  validate(input: string, question: Question): ValidationResult {
    if (question.challenge.type === "vi") {
      return viValidator.validate(input, question);
    }
    return regexValidator.validate(input, question);
  }
}

export const dispatchValidator = new DispatchValidator();

export { RegexValidator, regexValidator } from "./regex";
export { ViValidator, viValidator } from "./vi";
export type { Validator, ValidationResult } from "./types";
