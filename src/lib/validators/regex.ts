import type { Question } from "@/lib/questions/types";
import { isCommandQuestion } from "@/lib/questions/types";
import type { Validator, ValidationResult } from "./types";

/**
 * Validateur déterministe basé sur des patterns regex définis dans la question.
 *
 * Comportement :
 *  - normalise les espaces multiples et trim
 *  - chaque pattern est compilé avec le flag `i` (case-insensitive sur les flags)
 *  - on accepte la réponse dès qu'un pattern matche
 *  - les patterns doivent être ancrés (`^...$`) côté données pour éviter les
 *    faux positifs ; ce validateur n'ajoute pas d'ancres implicites
 */
export class RegexValidator implements Validator {
  validate(input: string, question: Question): ValidationResult {
    const normalized = input.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return { correct: false, notes: ["Saisie vide."] };
    }
    if (!isCommandQuestion(question)) {
      return {
        correct: false,
        notes: [
          "RegexValidator ne gère pas ce type de question (catégorie vi à venir)."
        ]
      };
    }
    for (const pattern of question.challenge.acceptedPatterns) {
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, "i");
      } catch {
        continue;
      }
      if (regex.test(normalized)) {
        return { correct: true, matchedPattern: pattern };
      }
    }
    return { correct: false };
  }
}

export const regexValidator = new RegexValidator();
