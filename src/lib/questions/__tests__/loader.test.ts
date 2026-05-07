import { describe, expect, it } from "vitest";
import { filterQuestions, shuffle } from "@/lib/questions/loader";
import type { Question } from "@/lib/questions/types";

const sample: Question[] = [
  {
    id: "k1",
    category: "kubectl",
    domain: "workloads-scheduling",
    scenario: { en: "x", fr: "x" },
    difficulty: 1,
    tags: ["pods"],
    challenge: { type: "command", expected: "x", acceptedPatterns: [] }
  },
  {
    id: "k2",
    category: "kubectl",
    domain: "services-networking",
    scenario: { en: "x", fr: "x" },
    difficulty: 4,
    tags: ["service"],
    challenge: { type: "command", expected: "x", acceptedPatterns: [] }
  },
  {
    id: "s1",
    category: "shell",
    domain: "troubleshooting",
    scenario: { en: "x", fr: "x" },
    difficulty: 2,
    tags: ["grep"],
    challenge: { type: "command", expected: "x", acceptedPatterns: [] }
  },
  {
    id: "v1",
    category: "vi",
    domain: "other",
    scenario: { en: "x", fr: "x" },
    difficulty: 1,
    challenge: { type: "vi", initialBuffer: "a", expectedBuffer: "a" }
  }
];

describe("loader filters & shuffle", () => {
  it("filters by category", () => {
    expect(
      filterQuestions(sample, { categories: ["shell"] }).map((q) => q.id)
    ).toEqual(["s1"]);
  });

  it("filters by domain", () => {
    expect(
      filterQuestions(sample, { domains: ["other"] }).map((q) => q.id)
    ).toEqual(["v1"]);
  });

  it("filters by max difficulty", () => {
    expect(
      filterQuestions(sample, { difficultyMax: 2 }).map((q) => q.id).sort()
    ).toEqual(["k1", "s1", "v1"]);
  });

  it("filters by tag (any-of)", () => {
    expect(
      filterQuestions(sample, { tags: ["pods", "grep"] })
        .map((q) => q.id)
        .sort()
    ).toEqual(["k1", "s1"]);
  });

  it("composes multiple filters", () => {
    expect(
      filterQuestions(sample, {
        categories: ["kubectl"],
        difficultyMax: 2
      }).map((q) => q.id)
    ).toEqual(["k1"]);
  });

  it("shuffle returns a permutation (preserves length and elements)", () => {
    const out = shuffle(sample);
    expect(out).toHaveLength(sample.length);
    expect(new Set(out.map((q) => q.id))).toEqual(
      new Set(sample.map((q) => q.id))
    );
  });

  it("shuffle is deterministic with a seed", () => {
    const a = shuffle(sample, 42);
    const b = shuffle(sample, 42);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it("shuffle with different seeds gives different orders (probabilistic)", () => {
    const a = shuffle([...Array(10).keys()], 1);
    const b = shuffle([...Array(10).keys()], 2);
    expect(a).not.toEqual(b);
  });
});
