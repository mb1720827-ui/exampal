// Blind-answer eval: Claude answers every question WITHOUT seeing the key, and we measure how often it agrees.
// Disagreements and reported problems are listed for a person to review before students see the question.
//
//   npm run eval                       # all questions
//   npm run eval -- --subject english  # one subject
//   npm run eval -- --limit 20         # quick, cheaper check
//   npm run eval -- --model claude-haiku-5-5
//
// Needs ANTHROPIC_API_KEY. Results are written to evals/results/.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { PROBLEMS, summarizeEval, type EvalResult } from "../src/lib/eval-score";
import { loadBank } from "../src/lib/load-bank";
import { LETTERS, type Question } from "../src/lib/questions";

const { values: args } = parseArgs({
  options: {
    subject: { type: "string", default: "all" },
    limit: { type: "string" },
    model: { type: "string", default: "claude-opus-5-5" },
    concurrency: { type: "string", default: "4" },
  },
});

const { bank } = loadBank(fileURLToPath(new URL("../bank", import.meta.url)));
const subjectName = new Map(bank.subjects.map((s) => [s.id, s.name]));
let questions: Question[] = bank.questions;
if (args.subject !== "all") questions = questions.filter((q) => q.subject === args.subject);
if (args.limit) questions = questions.slice(0, Number(args.limit));

const Verdict = z.object({
  answer: z.enum(["A", "B", "C", "D", "none"]),
  problems: z.array(z.enum(PROBLEMS)),
  note: z.string(),
});

const SYSTEM = `You review multiple-choice practice questions for Nigerian students preparing for the JAMB UTME.
Solve the question yourself, carefully, without assuming any option is correct.
- "answer": the letter of the correct option, or "none" if no option is correct.
- "problems": list any that apply, or an empty list: "ambiguous" (the question can reasonably be read two ways), "multiple_correct", "no_correct_option", "factual_error" (the question itself states something false), "outside_syllabus" (not something the UTME syllabus covers).
- "note": one short sentence explaining your answer or the problem.`;

const client = new Anthropic();

async function judge(q: Question): Promise<EvalResult> {
  const options = q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n");
  const response = await client.messages.parse({
    model: args.model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: `Subject: ${subjectName.get(q.subject) ?? q.subject}\nTopic: ${q.topic}\n\n${q.stem}\n\n${options}` }],
    output_config: { format: zodOutputFormat(Verdict) },
  });
  const verdict = response.stop_reason === "refusal" ? null : response.parsed_output;
  if (!verdict) return { id: q.id, topic: q.topic, key: q.answer, modelAnswer: null, problems: [], note: `No verdict (stop reason: ${response.stop_reason})` };
  return {
    id: q.id,
    topic: q.topic,
    key: q.answer,
    modelAnswer: verdict.answer === "none" ? null : LETTERS.indexOf(verdict.answer),
    problems: verdict.problems,
    note: verdict.note,
  };
}

async function main() {
  console.log(`Evaluating ${questions.length} questions with ${args.model}…`);
  const results: EvalResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < questions.length) {
      const q = questions[next++];
      try {
        results.push(await judge(q));
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) throw new Error("Set ANTHROPIC_API_KEY (or run `ant auth login`) and try again.");
        throw err;
      }
      process.stdout.write(`\r${results.length}/${questions.length}`);
    }
  };
  await Promise.all(Array.from({ length: Number(args.concurrency) }, worker));

  const summary = summarizeEval(results);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(new URL("../evals/results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL(`../evals/results/${stamp}.json`, import.meta.url),
    `${JSON.stringify({ model: args.model, subject: args.subject, ...summary, results }, null, 2)}\n`,
  );

  console.log(`\n\nAnswer-key agreement: ${(summary.agreement * 100).toFixed(1)}% (${summary.agreed}/${summary.total})`);
  for (const t of summary.byTopic) console.log(`  ${t.topic.padEnd(28)} ${t.agreed}/${t.total}`);
  if (summary.flagged.length > 0) {
    console.log(`\nReview these ${summary.flagged.length} questions:`);
    for (const f of summary.flagged) {
      const chose = f.modelAnswer === null ? "none" : LETTERS[f.modelAnswer];
      console.log(`  ${f.id}: key ${LETTERS[f.key]}, model ${chose}${f.problems.length ? ` [${f.problems.join(", ")}]` : ""} — ${f.note}`);
    }
  }
  console.log(`\nSaved to evals/results/${stamp}.json`);
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
