import { describe, expect, it } from "vitest";
import { pickQuestions, topicStats, weakTopics } from "./practice";
import type { Question } from "./questions";
import { mulberry32 } from "./rng";

const q = (id: string, topic: string): Question => ({
  id,
  subject: "mathematics",
  topic,
  stem: `Question ${id}`,
  options: ["right", "wrong 1", "wrong 2", "wrong 3"],
  answer: 0,
  explanation: "The answer is right.",
  source: "template",
});

const bank = [
  ...Array.from({ length: 6 }, (_, i) => q(`sets-${i}`, "Sets")),
  ...Array.from({ length: 6 }, (_, i) => q(`logs-${i}`, "Logarithms")),
];

describe("topicStats and weakTopics", () => {
  it("ranks topics from weakest to strongest", () => {
    const stats = topicStats([
      { questionId: "a", topic: "Sets", correct: true },
      { questionId: "b", topic: "Sets", correct: true },
      { questionId: "c", topic: "Logarithms", correct: false },
      { questionId: "d", topic: "Logarithms", correct: true },
    ]);
    expect(stats).toEqual([
      { topic: "Logarithms", attempts: 2, correct: 1, accuracy: 0.5 },
      { topic: "Sets", attempts: 2, correct: 2, accuracy: 1 },
    ]);
  });

  it("only calls a topic weak after at least 3 attempts", () => {
    const attempts = (topic: string, results: boolean[]) => results.map((correct, i) => ({ questionId: `${topic}${i}`, topic, correct }));
    const stats = topicStats([...attempts("Sets", [false, false]), ...attempts("Logarithms", [false, true, false])]);
    expect(weakTopics(stats)).toEqual(["Logarithms"]);
  });
});

describe("pickQuestions", () => {
  it("returns the requested number from the chosen topic", () => {
    const picked = pickQuestions(bank, mulberry32(1), { count: 4, topic: "Sets" });
    expect(picked).toHaveLength(4);
    expect(picked.every((p) => p.topic === "Sets")).toBe(true);
  });

  it("focuses on weak topics when there are enough questions", () => {
    const picked = pickQuestions(bank, mulberry32(2), { count: 5, focus: ["Logarithms"] });
    expect(picked.every((p) => p.topic === "Logarithms")).toBe(true);
  });

  it("prefers questions the student hasn't seen recently, but never returns too few", () => {
    const recent = new Set(["sets-0", "sets-1", "sets-2"]);
    const fresh = pickQuestions(bank, mulberry32(3), { count: 3, topic: "Sets", recent });
    expect(fresh.some((p) => recent.has(p.id))).toBe(false);
    expect(pickQuestions(bank, mulberry32(3), { count: 5, topic: "Sets", recent })).toHaveLength(5);
  });

  it("shuffles options but keeps the answer pointing at the right one", () => {
    const answerPositions = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const p of pickQuestions(bank, mulberry32(seed), { count: 6 })) {
        expect(p.options[p.answer]).toBe("right");
        answerPositions.add(p.answer);
      }
    }
    expect(answerPositions.size).toBe(4);
  });
});
