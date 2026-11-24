import { describe, expect, it } from "vitest";
import { decide, DraftsSchema, nextIds, toQuestion, topicSlug, type Draft, type Verdict } from "./factory";
import { mulberry32 } from "./rng";

const draft: Draft = {
  stem: "A car starts from rest and accelerates at 2 m/s^2 for 5 s. What is its final velocity?",
  options: ["10 m/s", "2.5 m/s", "7 m/s", "25 m/s"],
  answer: 0,
  explanation: "v = u + at = 0 + 2 x 5 = 10 m/s.",
};
const meta = { id: "phy-motion-01", subject: "physics", topic: "Motion" };
const ok = (number: number, answer: Verdict["answer"]): Verdict => ({ number, answer, problems: [], note: "v = u + at" });

describe("topicSlug", () => {
  it("makes file-safe slugs", () => {
    expect(topicSlug("Work, energy and power")).toBe("work-energy-and-power");
    expect(topicSlug("Simple a.c. circuits")).toBe("simple-a-c-circuits");
  });
});

describe("nextIds", () => {
  it("continues after the highest id for the same prefix", () => {
    expect(nextIds("phy-motion", ["phy-motion-01", "phy-motion-07", "phy-waves-09"], 2)).toEqual(["phy-motion-08", "phy-motion-09"]);
    expect(nextIds("phy-motion", [], 1)).toEqual(["phy-motion-01"]);
  });
});

describe("toQuestion", () => {
  it("shuffles options but keeps the key pointing at the correct one", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const q = toQuestion(draft, meta, mulberry32(seed));
      expect(q.options[q.answer]).toBe("10 m/s");
      expect([...q.options].sort()).toEqual([...draft.options].sort());
      expect(q.source).toBe("generated");
      positions.add(q.answer);
    }
    expect(positions.size).toBe(4);
  });
});

describe("decide", () => {
  const q = toQuestion(draft, meta, mulberry32(3));
  const key = "ABCD"[q.answer] as Verdict["answer"];
  const wrong = "ABCD"[(q.answer + 1) % 4] as Verdict["answer"];

  it("keeps a question the blind reviewer agrees with", () => {
    expect(decide([q], [ok(1, key)]).accepted).toEqual([q]);
  });

  it("rejects disagreements, reported problems and missing verdicts", () => {
    expect(decide([q], [ok(1, wrong)]).rejected[0].reason).toMatch(/chose/);
    expect(decide([q], [{ ...ok(1, key), problems: ["ambiguous"] }]).rejected[0].reason).toMatch(/ambiguous/);
    expect(decide([q], []).rejected[0].reason).toMatch(/no verdict/);
  });

  it("rejects explanations that name an option letter", () => {
    const lettered = { ...q, explanation: "Option A is right because v = u + at gives 10 m/s." };
    expect(decide([lettered], [ok(1, key)]).rejected[0].reason).toMatch(/letter/);
    const fine = { ...q, explanation: "The answer a student should get is 10 m/s, from v = u + at." };
    expect(decide([fine], [ok(1, key)]).accepted).toHaveLength(1);
  });
});

describe("DraftsSchema", () => {
  it("needs exactly four options", () => {
    expect(DraftsSchema.safeParse({ questions: [{ ...draft, options: ["a", "b", "c"] }] }).success).toBe(false);
    expect(DraftsSchema.safeParse({ questions: [draft] }).success).toBe(true);
  });
});
