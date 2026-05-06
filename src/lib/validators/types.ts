import type { Question } from "@/lib/questions/types";

export interface ValidationResult {
  /** L'utilisateur a-t-il fourni une réponse acceptable ? */
  correct: boolean;
  /** Pattern qui a matché (debug/affichage), si pertinent. */
  matchedPattern?: string;
  /** Détails optionnels à afficher (ex: flag inconnu, syntaxe alternative). */
  notes?: string[];
}

export interface Validator {
  /**
   * Valide une saisie utilisateur contre une question.
   * Doit être pur, déterministe, sans I/O ni appel réseau.
   */
  validate(input: string, question: Question): ValidationResult;
}
