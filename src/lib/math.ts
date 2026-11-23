import type { Question } from "./questions";
import { int, mulberry32, pick, shuffle, type Rng } from "./rng";

// ---------- formatting ----------

/** Numbers use the typographic minus sign, so "−3" reads cleanly in questions. */
export const num = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));
const paren = (n: number) => (n < 0 ? `(${num(n)})` : num(n));
const comma = (n: number) => n.toLocaleString("en-US");
const naira = (n: number) => `₦${comma(n)}`;
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sup = (n: number) => [...String(n)].map((c) => (c === "-" ? "⁻" : SUP[Number(c)])).join("");
const sub = (n: number | string) => [...String(n)].map((c) => SUB[Number(c)]).join("");

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export function frac(n: number, d: number): string {
  if (d === 0) throw new Error("zero denominator");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return d / g === 1 ? num(n / g) : `${num(n / g)}/${d / g}`;
}

/** Formats a polynomial in x, e.g. [{c: 2, p: 3}, {c: -3, p: 2}, {c: 5, p: 1}, {c: -1, p: 0}] → "2x³ − 3x² + 5x − 1". */
export function poly(terms: { c: number; p: number }[]): string {
  const parts: string[] = [];
  for (const { c, p } of terms) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = p === 0 ? String(abs) : `${abs === 1 ? "" : abs}x${p === 1 ? "" : sup(p)}`;
    if (parts.length === 0) parts.push(c < 0 ? `−${body}` : body);
    else parts.push(c < 0 ? `− ${body}` : `+ ${body}`);
  }
  return parts.length > 0 ? parts.join(" ") : "0";
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

const nonZero = (rng: Rng, min: number, max: number) => {
  let v = 0;
  while (v === 0) v = int(rng, min, max);
  return v;
};
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const choose = (n: number, r: number) => factorial(n) / (factorial(r) * factorial(n - r));
const arrange = (n: number, r: number) => factorial(n) / factorial(n - r);

// ---------- templates ----------

export interface Made {
  stem: string;
  correct: string;
  distractors: string[];
  explanation: string;
  /** Extra wrong options to use if the distractors collide with each other or the answer. */
  fallback: (i: number) => string;
  /** The numbers behind the question, so tests can check the answer independently. */
  params: Record<string, number | number[] | string>;
}

export interface Template {
  key: string;
  topic: string;
  make: (rng: Rng) => Made;
}

const intFallback = (answer: number) => (i: number) => num(answer + [1, -1, 2, -2, 3, -3, 5, -5, 10, -10][i % 10] * (1 + Math.floor(i / 10)));

function expand(digits: string, base: number): string {
  return [...digits].map((d, i) => `${d}×${base}${sup(digits.length - 1 - i)}`).join(" + ");
}

export const TEMPLATES: Template[] = [
  {
    key: "base-from-ten",
    topic: "Number bases",
    make(rng) {
      const n = int(rng, 9, 99);
      const b = pick(rng, [2, 3, 4, 5, 8]);
      const s = n.toString(b);
      const tag = (x: string) => `${x}${sub(b)}`;
      return {
        stem: `Convert ${n}${sub(10)} to base ${b}.`,
        correct: tag(s),
        distractors: [tag((n + 1).toString(b)), tag((n - 1).toString(b)), tag([...s].reverse().join(""))],
        explanation: `${expand(s, b)} = ${n}, so ${n}${sub(10)} = ${tag(s)}. To convert, divide by ${b} repeatedly and read the remainders from the last to the first.`,
        fallback: (i) => tag((n + 2 + i).toString(b)),
        params: { n, b },
      };
    },
  },
  {
    key: "base-to-ten",
    topic: "Number bases",
    make(rng) {
      const n = int(rng, 9, 99);
      const b = pick(rng, [2, 3, 4, 5, 8]);
      const s = n.toString(b);
      return {
        stem: `Convert ${s}${sub(b)} to base ten.`,
        correct: num(n),
        distractors: [num(n + 1), num(n - 1), num(parseInt([...s].reverse().join(""), b))],
        explanation: `Multiply each digit by its place value: ${expand(s, b)} = ${n}.`,
        fallback: intFallback(n),
        params: { n, b, digits: s },
      };
    },
  },
  {
    key: "indices",
    topic: "Indices",
    make(rng) {
      const a = pick(rng, [2, 3, 5]);
      const e = int(rng, 1, a === 5 ? 3 : 4);
      const m = int(rng, 2, 6);
      let n = int(rng, 1, 5);
      let p = m + n - e;
      if (p < 1) {
        n += 1 - p;
        p = 1;
      }
      const answer = a ** e;
      return {
        stem: `Evaluate ${a}${sup(m)} × ${a}${sup(n)} ÷ ${a}${sup(p)}.`,
        correct: num(answer),
        distractors: [num(a ** (e + 1)), num(a * e), num(a ** (e - 1))],
        explanation: `Add the powers when multiplying and subtract them when dividing: ${m} + ${n} − ${p} = ${e}. So the answer is ${a}${sup(e)} = ${answer}.`,
        fallback: intFallback(answer),
        params: { a, m, n, p },
      };
    },
  },
  {
    key: "logarithms",
    topic: "Logarithms",
    make(rng) {
      const b = pick(rng, [2, 3, 5, 10]);
      const x = int(rng, 1, 4);
      const y = int(rng, 1, 3);
      const [X, Y] = [b ** x, b ** y];
      return {
        stem: `Evaluate log${sub(b)} ${X} + log${sub(b)} ${Y}.`,
        correct: num(x + y),
        distractors: [num(x * y), num(x + y + 1), num(Math.abs(x - y))],
        explanation: `log${sub(b)} ${X} = ${x} because ${b}${sup(x)} = ${X}, and log${sub(b)} ${Y} = ${y} because ${b}${sup(y)} = ${Y}. So the sum is ${x} + ${y} = ${x + y}.`,
        fallback: intFallback(x + y),
        params: { b, X, Y },
      };
    },
  },
  {
    key: "simple-interest",
    topic: "Percentages and interest",
    make(rng) {
      const P = pick(rng, [5000, 10000, 20000, 25000, 40000, 50000]);
      const R = pick(rng, [2, 4, 5, 8, 10, 12, 15]);
      const T = int(rng, 2, 5);
      const SI = (P * R * T) / 100;
      const working = `Simple interest = PRT ÷ 100 = ${comma(P)} × ${R} × ${T} ÷ 100 = ${naira(SI)}.`;
      if (rng() < 0.5) {
        return {
          stem: `Find the simple interest on ${naira(P)} at ${R}% per annum for ${T} years.`,
          correct: naira(SI),
          distractors: [naira((P * R) / 100), naira(P + SI), naira((P * R * (T + 1)) / 100)],
          explanation: working,
          fallback: (i) => naira(SI + (i + 1) * 250),
          params: { P, R, T, kind: "interest" },
        };
      }
      return {
        stem: `${naira(P)} is invested at ${R}% simple interest per annum. Find the amount after ${T} years.`,
        correct: naira(P + SI),
        distractors: [naira(SI), naira(P + (P * R) / 100), naira(P + 2 * SI)],
        explanation: `${working} The amount is principal + interest = ${naira(P)} + ${naira(SI)} = ${naira(P + SI)}.`,
        fallback: (i) => naira(P + SI + (i + 1) * 250),
        params: { P, R, T, kind: "amount" },
      };
    },
  },
  {
    key: "sets",
    topic: "Sets",
    make(rng) {
      const a = int(rng, 12, 30);
      const b = int(rng, 10, 25);
      const x = int(rng, 3, Math.min(a, b) - 2);
      const k = int(rng, 2, 10);
      const N = a + b - x + k;
      const either = a + b - x;
      return {
        stem: `In a class of ${N} students, ${a} play football, ${b} play basketball and ${x} play both games. How many students play neither game?`,
        correct: num(k),
        distractors: [num(either), num(k + x), num(Math.max(1, Math.abs(N - a - b)))],
        explanation: `Students who play at least one game = ${a} + ${b} − ${x} = ${either}. So ${N} − ${either} = ${k} students play neither.`,
        fallback: intFallback(k),
        params: { N, a, b, x },
      };
    },
  },
  {
    key: "linear-equation",
    topic: "Linear equations",
    make(rng) {
      const x = nonZero(rng, -6, 9);
      const a = int(rng, 3, 8);
      const c = int(rng, 1, a - 1);
      const b = nonZero(rng, -10, 10);
      const d = (a - c) * x + b;
      const move = b > 0 ? `subtract ${b} from both sides` : `add ${-b} to both sides`;
      const coef = a - c === 1 ? "x" : `${a - c}x`;
      return {
        stem: `Solve for x: ${poly([{ c: a, p: 1 }, { c: b, p: 0 }])} = ${poly([{ c, p: 1 }, { c: d, p: 0 }])}`,
        correct: num(x),
        distractors: [num(-x), num(x + 1), Number.isInteger((d + b) / (a - c)) ? num((d + b) / (a - c)) : num(x - 2)],
        explanation: `Subtract ${c === 1 ? "x" : `${c}x`} from both sides and ${move}: ${coef} = ${num(d - b)}. So x = ${num(d - b)} ÷ ${a - c} = ${num(x)}.`,
        fallback: intFallback(x),
        params: { a, b, c, d },
      };
    },
  },
  {
    key: "quadratic-equation",
    topic: "Quadratic equations",
    make(rng) {
      const r1 = nonZero(rng, -6, 6);
      let r2 = nonZero(rng, -6, 6);
      while (r2 === r1) r2 = nonZero(rng, -6, 6);
      const B = -(r1 + r2);
      const C = r1 * r2;
      const roots = (p: number, q: number) => (p === q ? "" : `x = ${num(Math.max(p, q))} or x = ${num(Math.min(p, q))}`);
      const factor = (r: number) => (r > 0 ? `(x − ${r})` : `(x + ${-r})`);
      const eq = poly([{ c: 1, p: 2 }, { c: B, p: 1 }, { c: C, p: 0 }]);
      return {
        stem: `Solve the equation ${eq} = 0.`,
        correct: roots(r1, r2),
        distractors: [roots(-r1, -r2), roots(-r1, r2), roots(r1, -r2)],
        explanation: `Factorise: ${eq} = ${factor(Math.max(r1, r2))}${factor(Math.min(r1, r2))} = 0, so ${roots(r1, r2)}.`,
        fallback: (i) => roots(r1 + i + 1, r2 - i - 1) || roots(r1 + i + 2, r2),
        params: { B, C },
      };
    },
  },
  {
    key: "arithmetic-progression",
    topic: "Progressions",
    make(rng) {
      const a = int(rng, -5, 12);
      const d = (rng() < 0.3 ? -1 : 1) * int(rng, 2, 7);
      const n = int(rng, 8, 25);
      const answer = a + (n - 1) * d;
      const terms = [0, 1, 2, 3].map((i) => num(a + i * d)).join(", ");
      return {
        stem: `Find the ${ordinal(n)} term of the arithmetic progression ${terms}, …`,
        correct: num(answer),
        distractors: [num(a + n * d), num(a + (n - 2) * d), num(n * d)],
        explanation: `The first term a = ${num(a)} and the common difference d = ${num(d)}. The nth term is a + (n − 1)d = ${num(a)} + ${n - 1} × ${paren(d)} = ${num(answer)}.`,
        fallback: intFallback(answer),
        params: { a, d, n },
      };
    },
  },
  {
    key: "variation",
    topic: "Variation",
    make(rng) {
      if (rng() < 0.5) {
        const k = int(rng, 2, 9);
        const x1 = int(rng, 2, 9);
        let x2 = int(rng, 2, 12);
        while (x2 === x1) x2 = int(rng, 2, 12);
        const y1 = k * x1;
        return {
          stem: `y varies directly as x. If y = ${y1} when x = ${x1}, find y when x = ${x2}.`,
          correct: num(k * x2),
          distractors: [num(y1 + (x2 - x1)), num(y1 * x2), num(Math.max(1, Math.round(y1 / x2)))],
          explanation: `y = kx. From y = ${y1} when x = ${x1}, k = ${y1} ÷ ${x1} = ${k}. So when x = ${x2}, y = ${k} × ${x2} = ${k * x2}.`,
          fallback: intFallback(k * x2),
          params: { kind: "direct", x1, y1, x2 },
        };
      }
      // Inverse: pick the answer first, then an x1 that divides k evenly.
      for (;;) {
        const y2 = int(rng, 2, 12);
        const x2 = int(rng, 2, 9);
        const k = y2 * x2;
        const divisors = [2, 3, 4, 5, 6, 8, 9, 10, 12].filter((d) => d !== x2 && k % d === 0 && k / d > 1);
        if (divisors.length === 0) continue;
        const x1 = pick(rng, divisors);
        const y1 = k / x1;
        return {
          stem: `y varies inversely as x. If y = ${y1} when x = ${x1}, find y when x = ${x2}.`,
          correct: num(y2),
          distractors: [num(Number.isInteger((y1 * x2) / x1) ? (y1 * x2) / x1 : y1 * x2), num(k), num(y2 + 1)],
          explanation: `y = k ÷ x. From y = ${y1} when x = ${x1}, k = ${y1} × ${x1} = ${k}. So when x = ${x2}, y = ${k} ÷ ${x2} = ${y2}.`,
          fallback: intFallback(y2),
          params: { kind: "inverse", x1, y1, x2 },
        };
      }
    },
  },
  {
    key: "determinant",
    topic: "Matrices",
    make(rng) {
      const [a, b, c, d] = [int(rng, -5, 9), int(rng, -5, 9), int(rng, -5, 9), int(rng, -5, 9)];
      const det = a * d - b * c;
      return {
        stem: `Find the determinant of the matrix\n[ ${num(a)}  ${num(b)} ]\n[ ${num(c)}  ${num(d)} ]`,
        correct: num(det),
        distractors: [num(a * d + b * c), num(a * c - b * d), num(b * c - a * d)],
        explanation: `For the matrix [a b; c d], the determinant is ad − bc = ${paren(a)} × ${paren(d)} − ${paren(b)} × ${paren(c)} = ${num(a * d)} − ${paren(b * c)} = ${num(det)}.`,
        fallback: intFallback(det),
        params: { a, b, c, d },
      };
    },
  },
  {
    key: "coordinate-geometry",
    topic: "Coordinate geometry",
    make(rng) {
      const x1 = int(rng, -5, 5);
      const y1 = int(rng, -5, 5);
      const point = (x: number, y: number) => `(${num(x)}, ${num(y)})`;
      if (rng() < 0.5) {
        const dx = nonZero(rng, -6, 6);
        const dy = nonZero(rng, -8, 8);
        const [x2, y2] = [x1 + dx, y1 + dy];
        return {
          stem: `Find the gradient of the line joining ${point(x1, y1)} and ${point(x2, y2)}.`,
          correct: frac(dy, dx),
          distractors: [frac(dx, dy), frac(-dy, dx), x1 + x2 !== 0 ? frac(y1 + y2, x1 + x2) : frac(dy + 1, dx)],
          explanation: `Gradient = (y₂ − y₁) ÷ (x₂ − x₁) = (${num(y2)} − ${paren(y1)}) ÷ (${num(x2)} − ${paren(x1)}) = ${num(dy)} ÷ ${num(dx)} = ${frac(dy, dx)}.`,
          fallback: (i) => frac(dy + i + 2, dx),
          params: { kind: "gradient", x1, y1, x2, y2 },
        };
      }
      const [p, q, r] = pick(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]] as const);
      const [dx, dy] = (rng() < 0.5 ? [p, q] : [q, p]).map((v) => (rng() < 0.5 ? -v : v));
      const [x2, y2] = [x1 + dx, y1 + dy];
      return {
        stem: `Find the distance between the points ${point(x1, y1)} and ${point(x2, y2)}.`,
        correct: num(r),
        distractors: [num(p + q), num(r + 1), num(Math.abs(p - q))],
        explanation: `Distance = √((x₂ − x₁)² + (y₂ − y₁)²) = √(${Math.abs(dx)}² + ${Math.abs(dy)}²) = √${r * r} = ${r}.`,
        fallback: intFallback(r),
        params: { kind: "distance", x1, y1, x2, y2 },
      };
    },
  },
  {
    key: "mensuration",
    topic: "Mensuration",
    make(rng): Made {
      const r = pick(rng, [7, 14]);
      if (rng() < 0.5) {
        const h = int(rng, 3, 12);
        const V = (22 * r * r * h) / 7;
        const unit = (n: number) => `${comma(n)} cm³`;
        return {
          stem: `Find the volume of a cylinder of radius ${r} cm and height ${h} cm. (Take π = 22/7)`,
          correct: unit(V),
          distractors: [unit((2 * 22 * r * h) / 7), unit((22 * r * r) / 7), unit((22 * h * h * r) / 7)],
          explanation: `Volume = πr²h = 22/7 × ${r}² × ${h} = ${unit(V)}.`,
          fallback: (i) => unit(V + (i + 1) * 22),
          params: { kind: "cylinder", r, h },
        };
      }
      const A = (22 * r * r) / 7;
      const unit = (n: number) => `${comma(n)} cm²`;
      return {
        stem: `Find the area of a circle of radius ${r} cm. (Take π = 22/7)`,
        correct: unit(A),
        distractors: [unit((44 * r) / 7), unit((22 * 4 * r * r) / 7), unit((22 * r) / 7)],
        explanation: `Area = πr² = 22/7 × ${r}² = ${unit(A)}.`,
        fallback: (i) => unit(A + (i + 1) * 22),
        params: { kind: "circle", r },
      };
    },
  },
  {
    key: "differentiation",
    topic: "Differentiation",
    make(rng) {
      const a = int(rng, 1, 4);
      const b = int(rng, -5, 5);
      const c = int(rng, -6, 6);
      const d = int(rng, -5, 5);
      const x0 = int(rng, -2, 3);
      const f = (x: number) => a * x ** 3 + b * x ** 2 + c * x + d;
      const slope = 3 * a * x0 ** 2 + 2 * b * x0 + c;
      const y = poly([{ c: a, p: 3 }, { c: b, p: 2 }, { c, p: 1 }, { c: d, p: 0 }]);
      const dydx = poly([{ c: 3 * a, p: 2 }, { c: 2 * b, p: 1 }, { c, p: 0 }]);
      return {
        stem: `If y = ${y}, find dy/dx when x = ${num(x0)}.`,
        correct: num(slope),
        distractors: [num(f(x0)), num(slope - c), num(a * x0 ** 2 + b * x0 + c)],
        explanation: `Differentiate each term (multiply by the power, then reduce the power by 1): dy/dx = ${dydx}. When x = ${num(x0)}, dy/dx = ${num(slope)}.`,
        fallback: intFallback(slope),
        params: { a, b, c, d, x0 },
      };
    },
  },
  {
    key: "integration",
    topic: "Integration",
    make(rng) {
      const u = int(rng, 1, 4);
      const v = int(rng, -5, 6);
      const lo = int(rng, 0, 2);
      const hi = int(rng, lo + 1, lo + 4);
      const F = (x: number) => u * x * x + v * x;
      const answer = F(hi) - F(lo);
      const integrand = poly([{ c: 2 * u, p: 1 }, { c: v, p: 0 }]);
      return {
        stem: `Evaluate the integral of (${integrand}) dx from x = ${lo} to x = ${hi}.`,
        correct: num(answer),
        distractors: [num(F(hi)), num(F(hi) + F(lo)), num(2 * u * (hi - lo))],
        explanation: `The integral of ${integrand} is ${poly([{ c: u, p: 2 }, { c: v, p: 1 }])}. Substitute the limits: ${paren(F(hi))} − ${paren(F(lo))} = ${num(answer)}.`,
        fallback: intFallback(answer),
        params: { u, v, lo, hi },
      };
    },
  },
  {
    key: "mean",
    topic: "Statistics",
    make(rng) {
      const m = int(rng, 5, 15);
      const n = int(rng, 5, 7);
      for (;;) {
        const others = Array.from({ length: n - 1 }, () => int(rng, Math.max(1, m - 6), m + 6));
        const last = m * n - others.reduce((s, v) => s + v, 0);
        if (last < 1 || last > 30) continue;
        const values = shuffle(rng, [...others, last]);
        const sorted = [...values].sort((p, q) => p - q);
        const middle = sorted[Math.floor(n / 2)]; // a middle value, used only as a tempting wrong option
        return {
          stem: `Find the mean of the numbers ${values.join(", ")}.`,
          correct: num(m),
          distractors: [num(middle), num(m + 1), num(Math.round((m * n) / (n - 1)))],
          explanation: `Mean = sum of the numbers ÷ how many numbers there are = ${m * n} ÷ ${n} = ${m}.`,
          fallback: intFallback(m),
          params: { values },
        };
      }
    },
  },
  {
    key: "probability",
    topic: "Probability",
    make(rng) {
      const counts = { red: int(rng, 2, 8), blue: int(rng, 2, 8), green: int(rng, 1, 6) };
      const colour = pick(rng, ["red", "blue", "green"] as const);
      const total = counts.red + counts.blue + counts.green;
      const k = counts[colour];
      const simplified = frac(k, total);
      return {
        stem: `A bag contains ${counts.red} red, ${counts.blue} blue and ${counts.green} green balls. A ball is picked at random. What is the probability that it is ${colour}?`,
        correct: simplified,
        distractors: [frac(total - k, total), frac(k, total - k), frac(1, 3)],
        explanation: `There are ${counts.red} + ${counts.blue} + ${counts.green} = ${total} balls and ${k} are ${colour}, so the probability is ${k}/${total}${simplified === `${k}/${total}` ? "" : ` = ${simplified}`}.`,
        fallback: (i) => frac(k + i + 1, total + i + 2),
        params: { k, total },
      };
    },
  },
  {
    key: "combinatorics",
    topic: "Permutation and combination",
    make(rng) {
      const n = int(rng, 5, 10);
      const r = int(rng, 2, 4);
      const [C, P] = [choose(n, r), arrange(n, r)];
      if (rng() < 0.5) {
        return {
          stem: `In how many ways can a committee of ${r} be chosen from ${n} people?`,
          correct: num(C),
          distractors: [num(P), num(n * r), num(choose(n, r + 1))],
          explanation: `The order of choosing doesn't matter, so use combinations: ${n}C${r} = ${n}! ÷ (${r}! × ${n - r}!) = ${C}.`,
          fallback: intFallback(C),
          params: { kind: "combination", n, r },
        };
      }
      return {
        stem: `In how many ways can ${r} of ${n} different books be arranged in a row on a shelf?`,
        correct: num(P),
        distractors: [num(C), num(n * r), num(factorial(r))],
        explanation: `The order matters, so use permutations: ${n}P${r} = ${n}! ÷ ${n - r}! = ${P}.`,
        fallback: intFallback(P),
        params: { kind: "permutation", n, r },
      };
    },
  },
];

// ---------- building questions ----------

/** Puts the answer and three distinct wrong options in a seeded random order. */
export function assemble(rng: Rng, made: Made): { options: Question["options"]; answer: number } {
  const options = [made.correct];
  for (const d of made.distractors) if (d && !options.includes(d) && options.length < 4) options.push(d);
  for (let i = 0; options.length < 4; i++) {
    if (i > 100) throw new Error(`Couldn't find 4 distinct options for "${made.stem}"`);
    const f = made.fallback(i);
    if (f && !options.includes(f)) options.push(f);
  }
  const shuffled = shuffle(rng, options) as Question["options"];
  return { options: shuffled, answer: shuffled.indexOf(made.correct) };
}

export function makeQuestion(template: Template, seed: number): { question: Question; made: Made } {
  const rng = mulberry32(seed * 7919 + template.key.length);
  const made = template.make(rng);
  const { options, answer } = assemble(rng, made);
  return {
    made,
    question: {
      id: `math-${template.key}-${seed}`,
      subject: "mathematics",
      topic: template.topic,
      stem: made.stem,
      options,
      answer,
      explanation: made.explanation,
      source: "template",
    },
  };
}

export function buildMathBank(perTemplate = 12): Question[] {
  return TEMPLATES.flatMap((t) => Array.from({ length: perTemplate }, (_, i) => makeQuestion(t, i + 1).question));
}
