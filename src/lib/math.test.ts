import { describe, expect, it } from "vitest";
import { frac, makeQuestion, poly, TEMPLATES, type Made } from "./math";

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** "−1,540 cm³" → -1540, "3/4" → 0.75, "101₂" → "101" digits handled separately. */
const value = (s: string) => {
  const t = s.replace(/−/g, "-").replace(/₦|,|\s|cm³|cm²/g, "");
  if (t.includes("/")) {
    const [n, d] = t.split("/").map(Number);
    return n / d;
  }
  return Number(t);
};
const unsub = (s: string) => [...s].map((c) => (SUB.includes(c) ? "" : c)).join("");
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Independent checks: each recomputes the answer a different way from the template's own formula where possible. */
const verify: Record<string, (made: Made) => boolean> = {
  "base-from-ten": ({ correct, params }) => parseInt(unsub(correct), params.b as number) === params.n,
  "base-to-ten": ({ correct, params }) =>
    [...(params.digits as string)].reduce((acc, d) => acc * (params.b as number) + Number(d), 0) === value(correct),
  indices: ({ correct, params: { a, m, n, p } }) =>
    close((Math.pow(a as number, m as number) * Math.pow(a as number, n as number)) / Math.pow(a as number, p as number), value(correct)),
  logarithms: ({ correct, params: { b, X, Y } }) =>
    close(Math.log(X as number) / Math.log(b as number) + Math.log(Y as number) / Math.log(b as number), value(correct)),
  "simple-interest": ({ correct, params: { P, R, T, kind } }) => {
    let balance = P as number;
    for (let year = 0; year < (T as number); year++) balance += ((P as number) * (R as number)) / 100;
    return value(correct) === (kind === "amount" ? balance : balance - (P as number));
  },
  sets: ({ correct, params: { N, a, b, x } }) =>
    ((a as number) - (x as number)) + ((b as number) - (x as number)) + (x as number) + value(correct) === N,
  "linear-equation": ({ correct, params: { a, b, c, d } }) => {
    const x = value(correct);
    return (a as number) * x + (b as number) === (c as number) * x + (d as number);
  },
  "quadratic-equation": ({ correct, params: { B, C } }) => {
    const roots = [...correct.matchAll(/x = (−?\d+)/g)].map((m) => value(m[1]));
    return roots.length === 2 && roots[0] !== roots[1] && roots.every((r) => r * r + (B as number) * r + (C as number) === 0);
  },
  "arithmetic-progression": ({ correct, params: { a, d, n } }) => {
    let term = a as number;
    for (let i = 1; i < (n as number); i++) term += d as number;
    return term === value(correct);
  },
  variation: ({ correct, params: { kind, x1, y1, x2 } }) =>
    kind === "direct"
      ? close(value(correct) / (x2 as number), (y1 as number) / (x1 as number))
      : value(correct) * (x2 as number) === (y1 as number) * (x1 as number),
  determinant: ({ correct, params: { a, b, c, d } }) => value(correct) === (a as number) * (d as number) - (b as number) * (c as number),
  "coordinate-geometry": ({ correct, params: { kind, x1, y1, x2, y2 } }) => {
    const [dx, dy] = [(x2 as number) - (x1 as number), (y2 as number) - (y1 as number)];
    return kind === "gradient" ? close(value(correct), dy / dx) : close(value(correct), Math.hypot(dx, dy));
  },
  mensuration: ({ correct, params: { kind, r, h } }) => {
    const pi = 22 / 7;
    const expected = kind === "cylinder" ? pi * (r as number) ** 2 * (h as number) : pi * (r as number) ** 2;
    return close(value(correct), expected);
  },
  differentiation: ({ correct, params: { a, b, c, d, x0 } }) => {
    const f = (x: number) => (a as number) * x ** 3 + (b as number) * x ** 2 + (c as number) * x + (d as number);
    const h = 1e-4;
    const numeric = (f((x0 as number) + h) - f((x0 as number) - h)) / (2 * h);
    return Math.abs(numeric - value(correct)) < 1e-3;
  },
  integration: ({ correct, params: { u, v, lo, hi } }) => {
    // Simpson's rule on 2u·x + v (exact for straight lines).
    const f = (x: number) => 2 * (u as number) * x + (v as number);
    const [l, r] = [lo as number, hi as number];
    const simpson = ((r - l) / 6) * (f(l) + 4 * f((l + r) / 2) + f(r));
    return close(simpson, value(correct));
  },
  mean: ({ correct, params: { values } }) =>
    close((values as number[]).reduce((s, x) => s + x, 0) / (values as number[]).length, value(correct)),
  probability: ({ correct, params: { k, total } }) => close(value(correct), (k as number) / (total as number)),
  combinatorics: ({ correct, params: { kind, n, r } }) => {
    // Count by brute force: every ordered arrangement of r distinct items from n.
    let ordered = 0;
    const walk = (used: Set<number>) => {
      if (used.size === r) return void ordered++;
      for (let i = 0; i < (n as number); i++) if (!used.has(i)) walk(new Set(used).add(i));
    };
    walk(new Set());
    let unordered = ordered;
    for (let i = 2; i <= (r as number); i++) unordered /= i;
    return value(correct) === (kind === "permutation" ? ordered : unordered);
  },
};

describe("math templates", () => {
  it("has an independent check for every template", () => {
    expect(Object.keys(verify).sort()).toEqual(TEMPLATES.map((t) => t.key).sort());
  });

  for (const template of TEMPLATES) {
    it(`${template.key}: answers are correct and options are distinct`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        const { question, made } = makeQuestion(template, seed);
        const where = `${template.key} seed ${seed}: ${question.stem}`;
        expect(verify[template.key](made), where).toBe(true);
        expect(question.options[question.answer], where).toBe(made.correct);
        expect(new Set(question.options).size, where).toBe(4);
        // No wrong option may equal the answer in value (e.g. "2/4" vs "1/2").
        if (!/x =|[₀-₉]/.test(made.correct)) {
          const wrong = question.options.filter((_, i) => i !== question.answer).map(value);
          expect(wrong.some((w) => close(w, value(made.correct))), where).toBe(false);
        }
        expect(question.explanation, where).toContain(made.correct);
      }
    });
  }

  it("is deterministic for a given seed", () => {
    expect(makeQuestion(TEMPLATES[0], 3).question).toEqual(makeQuestion(TEMPLATES[0], 3).question);
  });
});

describe("formatting", () => {
  it("formats polynomials with proper signs and powers", () => {
    expect(poly([{ c: 2, p: 3 }, { c: -3, p: 2 }, { c: 1, p: 1 }, { c: -1, p: 0 }])).toBe("2x³ − 3x² + x − 1");
    expect(poly([{ c: -1, p: 2 }, { c: 0, p: 1 }, { c: 9, p: 0 }])).toBe("−x² + 9");
  });

  it("reduces fractions and keeps the sign in front", () => {
    expect(frac(6, 3)).toBe("2");
    expect(frac(3, -12)).toBe("−1/4");
    expect(frac(4, 6)).toBe("2/3");
  });
});
