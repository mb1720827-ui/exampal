import { describe, expect, it } from "vitest";
import english from "@/data/english.json";
import mathematics from "@/data/mathematics.json";
import { buildMathBank } from "./math";
import { QuestionSchema, SUBJECT_IDS, TOPICS } from "./questions";

const banks = { english: QuestionSchema.array().parse(english), mathematics: QuestionSchema.array().parse(mathematics) };
const all = Object.values(banks).flat();

// These checks run in CI, so a broken or mis-keyed question can never reach students.
describe("question banks", () => {
  it("every question id is unique", () => {
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
  });

  it("no question appears twice", () => {
    const keys = all.map((q) => `${q.stem}|${q.options.join("|")}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  for (const subject of SUBJECT_IDS) {
    it(`${subject}: every question uses a syllabus topic, and every topic has questions`, () => {
      const used = new Set(banks[subject].map((q) => q.topic));
      for (const q of banks[subject]) expect(TOPICS[subject], q.id).toContain(q.topic);
      for (const topic of TOPICS[subject]) expect(used, topic).toContain(topic);
    });
  }

  it("every question has four different options", () => {
    for (const q of all) expect(new Set(q.options.map((o) => o.trim().toLowerCase())).size, q.id).toBe(4);
  });

  it("every explanation names the correct option, which catches answer keys pointing at the wrong one", () => {
    for (const q of all) expect(q.explanation.toLowerCase(), q.id).toContain(q.options[q.answer].toLowerCase());
  });

  it("hand-written answers are spread across A to D", () => {
    const positions = banks.english.map((q) => q.answer);
    for (const p of [0, 1, 2, 3]) expect(positions.filter((x) => x === p).length).toBeGreaterThan(positions.length / 8);
  });

  it("mathematics.json matches the templates (run `npm run bank` after changing them)", () => {
    expect(banks.mathematics).toEqual(buildMathBank());
  });
});
