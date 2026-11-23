// Regenerates src/data/mathematics.json from the templates. Run after changing src/lib/math.ts: npm run bank
import { writeFileSync } from "node:fs";
import { buildMathBank } from "../src/lib/math";

const bank = buildMathBank();
writeFileSync(new URL("../src/data/mathematics.json", import.meta.url), `${JSON.stringify(bank, null, 2)}\n`);
console.log(`Wrote ${bank.length} mathematics questions.`);
