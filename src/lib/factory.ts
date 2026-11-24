// Pure helpers for the question factory (scripts/factory.ts): AI drafts questions, a blind second run answers them,
// and only questions it agrees with are kept.
import { z } from "zod";
import { PROBLEMS } from "./eval-score";
import { LETTERS, type Question } from "./questions";
import { shuffle, type Rng } from "./rng";

/** What Claude returns when drafting. Options are a plain array (not a tuple) so the JSON schema stays simple. */
export const DraftsSchema = z.object({
  questions: z
    .array(
      z.object({
        stem: z.string().min(5).max(1500),
        options: z.array(z.string().min(1).max(300)).length(4),
        answer: z.number().int().min(0).max(3),
        explanation: z.string().min(10).max(1000),
      }),
    )
    .min(1)
    .max(20),
});
export type Draft = z.infer<typeof DraftsSchema>["questions"][number];

/** What the blind reviewer returns: one verdict per numbered question. It never sees the answer key. */
export const VerdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      number: z.number().int().min(1),
      answer: z.enum(["A", "B", "C", "D", "none"]),
      problems: z.array(z.enum(PROBLEMS)),
      note: z.string(),
    }),
  ),
});
export type Verdict = z.infer<typeof VerdictsSchema>["verdicts"][number];

/** "Work, energy and power" -> "work-energy-and-power". Used for file names and question ids. */
export const topicSlug = (topic: string) =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50)
    .replace(/^-+|-+$/g, "");

/** The next free ids like "phy-motion-07", continuing after the highest number already used. */
export function nextIds(prefix: string, existing: Iterable<string>, count: number): string[] {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const id of existing) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(2, "0")}`);
}

/** Turns a draft into a bank question, shuffling the options so the correct one isn't always in the same place. */
export function toQuestion(draft: Draft, meta: { id: string; subject: string; topic: string }, rng: Rng): Question {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return {
    ...meta,
    stem: draft.stem.trim(),
    options: order.map((i) => draft.options[i].trim()) as Question["options"],
    answer: order.indexOf(draft.answer),
    explanation: draft.explanation.trim(),
    source: "generated",
  };
}

// "option B", "Answer (C)": wrong after shuffling. Capital letters only, so "the answer a student gives" is fine.
const LETTER_REFERENCE = /\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice)\s+\(?[A-D]\)?(?=[\s.,;:)]|$)/;

/** Keeps a question only if the blind reviewer chose the same option and reported no problems. */
export function decide(questions: Question[], verdicts: Verdict[]) {
  const accepted: Question[] = [];
  const rejected: { question: Question; reason: string }[] = [];
  questions.forEach((q, i) => {
    const v = verdicts.find((verdict) => verdict.number === i + 1);
    const key = LETTERS[q.answer];
    const reason = !v
      ? "the blind reviewer gave no verdict"
      : v.answer !== key
        ? `the blind reviewer chose ${v.answer}, the key says ${key}: ${v.note}`
        : v.problems.length > 0
          ? `${v.problems.join(", ")}: ${v.note}`
          : LETTER_REFERENCE.test(q.explanation)
            ? "the explanation refers to an option by letter, which breaks when options are shuffled"
            : null;
    if (reason) rejected.push({ question: q, reason });
    else accepted.push(q);
  });
  return { accepted, rejected };
}
