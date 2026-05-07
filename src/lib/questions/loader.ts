import kubectlQuestions from "@/data/questions/kubectl.json";
import shellQuestions from "@/data/questions/shell.json";
import viQuestions from "@/data/questions/vi.json";
import type { Question } from "./types";

/**
 * Loads all bundled questions across categories. Sprint 5 added shell and
 * vi categories alongside kubectl. The loader stays a single function so
 * filtering/shuffling at the call site can mix categories naturally.
 */
export function loadAllQuestions(): Question[] {
  return [
    ...(kubectlQuestions as Question[]),
    ...(shellQuestions as Question[]),
    ...(viQuestions as Question[])
  ];
}

export interface QuestionFilter {
  categories?: Array<"kubectl" | "shell" | "vi">;
  domains?: string[];
  difficultyMax?: number;
  tags?: string[];
}

export function filterQuestions(
  questions: Question[],
  filter: QuestionFilter
): Question[] {
  return questions.filter((q) => {
    if (filter.categories && !filter.categories.includes(q.category))
      return false;
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
