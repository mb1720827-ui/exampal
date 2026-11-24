import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBank } from "./load-bank";

// These checks run in CI on every pull request, so a broken or mis-keyed question can never reach students.
describe("the real question bank", () => {
  const { bank, problems } = loadBank(join(process.cwd(), "bank"));

  it("has no problems", () => {
    expect(problems).toEqual([]);
  });

  it("includes the generated maths and the written English questions", () => {
    expect(bank.questions.filter((q) => q.subject === "mathematics" && q.source === "template").length).toBe(216);
    expect(bank.questions.filter((q) => q.subject === "english").length).toBeGreaterThanOrEqual(64);
  });
});

/** Builds a throwaway bank with one English topic file, to check the messages contributors see. */
function bankWith(questions: unknown, subjects: unknown = [{ id: "english", name: "Use of English", topics: ["Spelling"] }]) {
  const root = mkdtempSync(join(tmpdir(), "bank-"));
  writeFileSync(join(root, "subjects.json"), JSON.stringify(subjects));
  mkdirSync(join(root, "english"));
  writeFileSync(join(root, "english", "spelling.json"), typeof questions === "string" ? questions : JSON.stringify(questions));
  return loadBank(root);
}

const good = {
  id: "eng-spe-x1",
  subject: "english",
  topic: "Spelling",
  stem: "Choose the correctly spelt word.",
  options: ["recieve", "receive", "receeve", "riceive"],
  answer: 1,
  explanation: "The correct spelling is \"receive\": i before e, except after c.",
  source: "authored",
  author: "ada-lovelace",
};

describe("checks contributors get", () => {
  it("accepts a well-formed question with author credit", () => {
    const { bank, problems } = bankWith([good]);
    expect(problems).toEqual([]);
    expect(bank.questions[0].author).toBe("ada-lovelace");
  });

  const messageFor = (questions: unknown, subjects?: unknown) => bankWith(questions, subjects).problems.map((p) => `${p.id ?? ""}: ${p.message}`).join("\n");

  it("catches an answer key pointing at the wrong option", () => {
    expect(messageFor([{ ...good, answer: 0 }])).toMatch(/explanation must mention the correct option \("recieve"\)/);
  });

  it("catches misspelt fields", () => {
    const misspelt: Record<string, unknown> = { ...good, anwser: 1 };
    delete misspelt.answer;
    expect(messageFor([misspelt])).toMatch(/unknown field\(s\) "anwser"/);
  });

  it("catches topics that aren't in the syllabus list", () => {
    expect(messageFor([{ ...good, topic: "Phonics" }])).toMatch(/topic "Phonics" isn't listed for english.*Use one of: Spelling/);
  });

  it("catches duplicate ids and duplicate questions", () => {
    const text = messageFor([good, { ...good, id: "eng-spe-x2" }, { ...good, stem: "Pick the right spelling." }]);
    expect(text).toMatch(/eng-spe-x2: this question is a duplicate of eng-spe-x1/);
    expect(text).toMatch(/the id "eng-spe-x1" is already used/);
  });

  it("catches repeated options, the wrong subject and invalid JSON", () => {
    expect(messageFor([{ ...good, options: ["receive", "Receive", "recieve", "riceive"] }])).toMatch(/four options must all be different/);
    expect(messageFor([{ ...good, subject: "maths" }])).toMatch(/"subject" must be "english"/);
    expect(messageFor("[ { not json")).toMatch(/isn't valid JSON/);
  });

  it("catches a broken subjects.json", () => {
    expect(messageFor([good], [{ id: "English!", name: "E", topics: [] }])).toMatch(/lowercase letters and hyphens/);
  });
});
