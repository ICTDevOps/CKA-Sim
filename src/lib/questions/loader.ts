import kubectlQuestions from "@/data/questions/kubectl.json";
import type { Question } from "./types";

/**
 * Charge toutes les questions disponibles. Pour le MVP, les questions sont
 * chargées depuis des fichiers JSON statiques bundlés avec l'app.
 *
 * Plus tard : chargement depuis SQLite (pour la base utilisateur), ou depuis
 * un endpoint API pour les questions générées par l'IA.
 */
export function loadAllQuestions(): Question[] {
  return kubectlQuestions as Question[];
}

export interface QuestionFilter {
  domains?: string[];
  difficultyMax?: number;
  tags?: string[];
}

export function filterQuestions(
  questions: Question[],
  filter: QuestionFilter
): Question[] {
  return questions.filter((q) => {
    if (filter.domains && !filter.domains.includes(q.domain)) return false;
    if (filter.difficultyMax && q.difficulty > filter.difficultyMax)
      return false;
    if (filter.tags && filter.tags.length > 0) {
      const qTags = q.tags ?? [];
      if (!filter.tags.some((t) => qTags.includes(t))) return false;
    }
    return true;
  });
}

/**
 * Mélange une liste de questions avec un algorithme Fisher-Yates.
 * Si une seed est fournie, le mélange est déterministe (pratique pour les
 * tests, ou pour rejouer une session identique).
 */
export function shuffle<T>(items: T[], seed?: number): T[] {
  const arr = [...items];
  let rng: () => number;
  if (seed === undefined) {
    rng = Math.random;
  } else {
    let s = seed;
    rng = () => {
      s = (s * 1664525 + 1013904223) % 0x100000000;
      return s / 0x100000000;
    };
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
