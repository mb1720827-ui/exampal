// Question factory: Claude Code drafts questions for one syllabus topic, a second, separate Claude Code run answers
// them WITHOUT the key, and only the questions it agrees with (and that pass the bank checks) are added to bank/.
//
//   npm run factory -- --subject physics --topic "Motion"                  # 5 questions
//   npm run factory -- --subject chemistry --topic "Electrolysis" --count 10
//   npm run factory -- --subject biology --topic "Nutrition" --pr          # also opens a pull request for review
//
// Uses your Claude Code login, so no API key is needed. Every question still needs a person's review before merging.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { REVIEW_INSTRUCTIONS } from "../src/lib/eval-score";
import { decide, DraftsSchema, nextIds, toQuestion, topicSlug, VerdictsSchema } from "../src/lib/factory";
import { loadBank } from "../src/lib/load-bank";
import { LETTERS, type Question } from "../src/lib/questions";
import { mulberry32 } from "../src/lib/rng";

const { values: args } = parseArgs({
  options: {
    subject: { type: "string" },
    topic: { type: "string" },
    count: { type: "string", default: "5" },
    model: { type: "string" },
    pr: { type: "boolean", default: false },
  },
});

const root = fileURLToPath(new URL("../bank", import.meta.url));

async function main() {
  const { bank, problems } = loadBank(root);
  if (problems.length > 0) throw new Error("The question bank already has problems. Run `npm run check` and fix them first.");
  const subject = bank.subjects.find((s) => s.id === args.subject);
  if (!subject) throw new Error(`--subject must be one of: ${bank.subjects.map((s) => s.id).join(", ")}`);
  const topic = subject.topics.find((t) => t.toLowerCase() === args.topic?.toLowerCase());
  if (!topic) throw new Error(`--topic must be one of the ${subject.name} topics: ${subject.topics.join(", ")}`);
  const count = Number(args.count);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("--count must be a whole number from 1 to 20");

  const claude = findClaude();
  const existing = bank.questions.filter((q) => q.subject === subject.id && q.topic === topic);

  log(`Drafting ${count} ${subject.name} questions on "${topic}"…`);
  const drafts = DraftsSchema.parse(await runClaude(claude, draftPrompt(subject.name, topic, count, existing), DraftsSchema)).questions.slice(0, count);
  const ids = nextIds(`${subject.id.slice(0, 3)}-${topicSlug(topic)}`, bank.questions.map((q) => q.id), drafts.length);
  const rng = mulberry32(Date.now());
  const questions = drafts.map((d, i) => toQuestion(d, { id: ids[i], subject: subject.id, topic }, rng));

  log(`Answering them blind in a separate run…`);
  const { verdicts } = VerdictsSchema.parse(await runClaude(claude, reviewPrompt(subject.name, topic, questions), VerdictsSchema));
  const decided = decide(questions, verdicts);
  const rejected = decided.rejected;
  let accepted = decided.accepted;

  // Add the survivors to the topic's file, then run the same checks as `npm run check` and drop any that fail.
  const file = join(root, subject.id, `${topicSlug(topic)}.json`);
  const before: unknown[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  const save = () => {
    if (before.length + accepted.length === 0) return rmSync(file, { force: true });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify([...before, ...accepted], null, 2)}\n`);
  };
  save();
  const failing = new Map(loadBank(root).problems.flatMap((p) => (p.id ? [[p.id, p.message] as const] : [])));
  for (const q of accepted.filter((q) => failing.has(q.id))) rejected.push({ question: q, reason: `bank check: ${failing.get(q.id)}` });
  accepted = accepted.filter((q) => !failing.has(q.id));
  save();
  const left = loadBank(root).problems;
  if (left.length > 0) throw new Error(`The bank check still fails: ${left[0].message}`);

  log(`Kept ${accepted.length} of ${questions.length}.`);
  for (const r of rejected) console.log(`  ✗ ${r.question.stem.slice(0, 70)}… ${r.reason}`);
  if (accepted.length === 0) return;
  const where = relative(process.cwd(), file).replace(/\\/g, "/");
  console.log(`\nAdded to ${where}. Read every question before it reaches students.`);

  if (args.pr) {
    const notes = new Map(questions.map((q, i) => [q.id, verdicts.find((v) => v.number === i + 1)?.note ?? ""]));
    const command = `npm run factory -- --subject ${subject.id} --topic "${topic}" --count ${count}`;
    openPullRequest(where, `Add ${accepted.length} ${subject.name} questions: ${topic}`, prBody(command, accepted, rejected, questions.length, notes), subject.id, topic);
  }
}

function draftPrompt(subject: string, topic: string, count: number, existing: Question[]): string {
  const avoid = existing.length > 0 ? `\nDon't repeat or closely copy these existing questions:\n${existing.map((q) => `- ${q.stem}`).join("\n")}\n` : "";
  return `You write multiple-choice practice questions for Nigerian students preparing for the JAMB UTME.

Subject: ${subject}
Topic: ${topic} (from the official UTME syllabus)

Write ${count} new questions on this topic.

Rules:
- Match real UTME questions in style and difficulty: one clear stem, four options, exactly one correct option.
- Cover different parts of the topic, and mix recall, understanding and short calculations where the topic has them.
- Wrong options should be believable mistakes a student might make.
- Use SI units. Calculations should give clean numbers.
- Write formulas in plain text (v = u + at, 9.8 m/s^2, H2SO4). No LaTeX or Markdown.
- "answer" is the index (0-3) of the correct option.
- "explanation" is 1-3 sentences. It must contain the exact text of the correct option and show why it is right.
- Never refer to options by letter or position (no "option B"), because the options are shuffled afterwards.
- Stay inside the UTME syllabus and be factually exact. If unsure about a fact, write a different question.
${avoid}`;
}

function reviewPrompt(subject: string, topic: string, questions: Question[]): string {
  const blocks = questions.map(
    (q, i) => `Question ${i + 1}\nSubject: ${subject}\nTopic: ${topic}\n\n${q.stem}\n\n${q.options.map((o, j) => `${LETTERS[j]}. ${o}`).join("\n")}`,
  );
  return `${REVIEW_INSTRUCTIONS}\n\nThere are ${questions.length} questions below. Return one verdict for each, with its "number".\n\n${blocks.join("\n\n---\n\n")}`;
}

function prBody(command: string, accepted: Question[], rejected: { question: Question; reason: string }[], total: number, notes: Map<string, string>): string {
  const kept = accepted.map((q) =>
    [
      `### ${q.id}`,
      q.stem,
      q.options.map((o, i) => (i === q.answer ? `- **${LETTERS[i]}. ${o}** ✓` : `- ${LETTERS[i]}. ${o}`)).join("\n"),
      `**Explanation:** ${q.explanation}`,
      `**Blind reviewer:** ${notes.get(q.id) ?? ""}`,
    ].join("\n\n"),
  );
  const dropped = rejected.map((r) => `- "${r.question.stem.slice(0, 90)}…": ${r.reason}`);
  return [
    `Drafted by Claude Code with \`${command}\`.`,
    `**Kept ${accepted.length} of ${total}.** Each kept question was answered by a separate run that never saw the key; it picked the same option and reported no problems. \`npm run check\` passes.`,
    "Before merging, please check that each question is accurate, on the UTME syllabus and clearly worded. Edit or delete any that aren't.",
    ...kept,
    ...(dropped.length > 0 ? ["### Rejected by the checks", dropped.join("\n")] : []),
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n\n");
}

function openPullRequest(file: string, title: string, body: string, subject: string, topic: string) {
  const git = (...a: string[]) => execFileSync("git", a, { encoding: "utf8" }).trim();
  const start = git("rev-parse", "--abbrev-ref", "HEAD");
  const branch = `factory/${subject}-${topicSlug(topic)}-${Date.now().toString(36)}`;
  git("switch", "-c", branch);
  try {
    git("add", file);
    git("commit", "-m", title, "-m", "Drafted and blind-checked by npm run factory.", "-m", "Co-Authored-By: Claude <noreply@anthropic.com>");
    git("push", "-u", "origin", branch);
    const url = execFileSync("gh", ["pr", "create", "--head", branch, "--title", title, "--body-file", "-"], { input: body, encoding: "utf8" }).trim();
    log(`Pull request: ${url}`);
  } finally {
    git("switch", start);
  }
}

async function runClaude(claude: string, prompt: string, schema: z.ZodType): Promise<unknown> {
  // Isolated: an empty temporary folder, no shell or code tools, no personal hooks, plugins or MCP servers.
  const dir = mkdtempSync(join(tmpdir(), "exampal-factory-"));
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
  const cli = ["-p", "--output-format", "json", "--json-schema", JSON.stringify(jsonSchema), "--allowedTools", "Read",
    "--permission-mode", "dontAsk", "--restricted", "--setting-sources", "project", "--strict-mcp-config", "--no-session-persistence"];
  if (args.model) cli.push("--model", args.model);
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(claude, cli, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      let err = "";
      const timer = setTimeout(() => child.kill(), 15 * 60_000);
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`Claude Code exited with ${code}: ${(err || out).slice(0, 300)}`));
      });
      child.stdin.end(prompt);
    });
    const result = JSON.parse(stdout);
    if (result.is_error) throw new Error(`Claude Code: ${String(result.result).slice(0, 300)}`);
    return result.structured_output;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function findClaude(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  for (const dir of (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
    if (dir && existsSync(join(dir, exe))) return join(dir, exe);
  }
  // The VS Code extension ships its own copy.
  const extensions = join(homedir(), ".vscode", "extensions");
  const bundled = existsSync(extensions)
    ? readdirSync(extensions)
        .filter((d) => d.startsWith("anthropic.claude-code-"))
        .map((d) => join(extensions, d, "resources", "native-binary", exe))
        .filter((p) => existsSync(p))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    : [];
  if (bundled[0]) return bundled[0];
  throw new Error("Claude Code isn't installed. Install it (npm install -g @anthropic-ai/claude-code) or set CLAUDE_BIN.");
}

const log = (message: string) => console.log(`[${new Date().toLocaleTimeString()}] ${message}`);

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
