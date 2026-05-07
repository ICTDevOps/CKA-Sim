import { describe, expect, it } from "vitest";
import { DispatchValidator } from "@/lib/validators";
import type { CommandQuestion, ViQuestion } from "@/lib/questions/types";

const validator = new DispatchValidator();

const cmd: CommandQuestion = {
  id: "c",
  category: "kubectl",
  domain: "other",
  scenario: { en: "x", fr: "x" },
  difficulty: 1,
  challenge: {
    type: "command",
    expected: "kubectl get pods",
    acceptedPatterns: ["^kubectl\\s+get\\s+pods$"]
  }
};

const viQ: ViQuestion = {
  id: "v",
  category: "vi",
  domain: "other",
  scenario: { en: "x", fr: "x" },
  difficulty: 1,
  challenge: {
    type: "vi",
    initialBuffer: "hello",
    expectedBuffer: "world"
  }
};

describe("DispatchValidator", () => {
  it("routes command questions to the regex validator", () => {
    expect(validator.validate("kubectl get pods", cmd).correct).toBe(true);
    expect(validator.validate("k describe pods", cmd).correct).toBe(false);
  });

  it("routes vi questions to the vi validator", () => {
    expect(validator.validate("world", viQ).correct).toBe(true);
    expect(validator.validate("hello", viQ).correct).toBe(false);
  });
});
