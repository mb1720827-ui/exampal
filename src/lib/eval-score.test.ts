import { describe, expect, it } from "vitest";
import { summarizeEval, type EvalResult } from "./eval-score";

const r = (id: string, topic: string, key: number, modelAnswer: number | null, problems: EvalResult["problems"] = []): EvalResult => ({
  id,
  topic,
  key,
  modelAnswer,
  problems,
  note: "",
});

describe("summarizeEval", () => {
  it("measures agreement and flags disagreements and reported problems", () => {
    const results = [
      r("a", "Sets", 0, 0),
      r("b", "Sets", 1, 1, ["ambiguous"]),
      r("c", "Spelling", 2, 3),
      r("d", "Spelling", 3, null, ["no_correct_option"]),
    ];
    const s = summarizeEval(results);
    expect(s.total).toBe(4);
    expect(s.agreed).toBe(2);
    expect(s.agreement).toBe(0.5);
    expect(s.flagged.map((f) => f.id)).toEqual(["b", "c", "d"]);
    expect(s.byTopic).toEqual([
      { topic: "Spelling", total: 2, agreed: 0 },
      { topic: "Sets", total: 2, agreed: 2 },
    ]);
  });

  it("handles an empty run", () => {
    expect(summarizeEval([])).toMatchObject({ total: 0, agreement: 0, flagged: [] });
  });
});
