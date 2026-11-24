// Checks every question in bank/ and compiles them into src/data/bank.generated.json for the app.
// Runs automatically before dev, build and test. Run it yourself after editing questions: npm run check
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadBank } from "../src/lib/load-bank";

const { bank, problems } = loadBank(fileURLToPath(new URL("../bank", import.meta.url)));

if (problems.length > 0) {
  console.error(`\n✗ Found ${problems.length} problem${problems.length === 1 ? "" : "s"} in the question bank:\n`);
  for (const p of problems) console.error(`  ${p.file}${p.id ? ` › ${p.id}` : ""}\n    ${p.message}\n`);
  process.exit(1);
}

mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/bank.generated.json", import.meta.url), JSON.stringify(bank));
const counts = bank.subjects.map((s) => `${s.name}: ${bank.questions.filter((q) => q.subject === s.id).length}`);
console.log(`✓ Question bank OK — ${bank.questions.length} questions (${counts.join(", ")})`);
