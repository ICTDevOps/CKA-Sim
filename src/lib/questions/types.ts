/**
 * Types décrivant une question du simulateur.
 *
 * Texte bilingue : tout champ user-facing (énoncé, hints, explication) est
 * stocké comme `{ en, fr }`. Les champs « langue-neutres » — id, regex,
 * commande canonique — restent des chaînes simples.
 */

export type QuestionCategory = "kubectl" | "shell" | "vi";

export type CkaDomain =
  | "cluster-architecture"
  | "workloads-scheduling"
  | "services-networking"
  | "storage"
  | "troubleshooting"
  | "other";

export type Locale = "en" | "fr";

export interface LocalizedString {
  en: string;
  fr: string;
}

export interface LocalizedStringArray {
  en: string[];
  fr: string[];
}

/**
 * Selects the right text for the active locale, falling back to English if a
 * translation is missing. Tolerates the legacy plain-string format that was
 * used before the bilingual migration: a string is treated as both EN and FR.
 */
export function localized(
  value: LocalizedString | string | undefined,
  locale: Locale
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] ?? value.en ?? "";
}

export function localizedArray(
  value: LocalizedStringArray | string[] | undefined,
  locale: Locale
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value[locale] ?? value.en ?? [];
}

export interface BaseQuestion {
  id: string;
  category: QuestionCategory;
  domain: CkaDomain;
  scenario: LocalizedString;
  difficulty: 1 | 2 | 3 | 4 | 5;
  hints?: LocalizedStringArray;
  docUrls?: string[];
  k8sVersion?: string;
  tags?: string[];
}

export interface CommandQuestion extends BaseQuestion {
  category: "kubectl" | "shell";
  challenge: {
    type: "command";
    acceptedPatterns: string[];
    expected: string;
    explanation?: LocalizedString;
  };
}

export interface ViQuestion extends BaseQuestion {
  category: "vi";
  challenge: {
    type: "vi";
    initialBuffer: string;
    expectedBuffer: string | string[];
    optimalKeystrokes?: number;
    explanation?: LocalizedString;
  };
}

export type Question = CommandQuestion | ViQuestion;

export function isCommandQuestion(q: Question): q is CommandQuestion {
  return q.challenge.type === "command";
}
