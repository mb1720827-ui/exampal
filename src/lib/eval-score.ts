export const PROBLEMS = ["ambiguous", "multiple_correct", "no_correct_option", "factual_error", "outside_syllabus"] as const;
export type Problem = (typeof PROBLEMS)[number];

/** Instructions for a blind review: the model solves each question without seeing the answer key. Used by npm run eval and npm run factory. */
export const REVIEW_INSTRUCTIONS = `You review multiple-choice practice questions for Nigerian students preparing for the JAMB UTME.
Solve the question yourself, carefully, without assuming any option is correct.
- "answer": the letter of the correct option, or "none" if no option is correct.
- "problems": list any that apply, or an empty list: "ambiguous" (the question can reasonably be read two ways), "multiple_correct", "no_correct_option", "factual_error" (the question itself states something false), "outside_syllabus" (not something the UTME syllabus covers).
- "note": one short sentence explaining your answer or the problem.`;

export interface EvalResult {
  id: string;
  topic: string;
  /** Index of the answer in the bank. */
  key: number;
  /** Index the model chose without seeing the key, or null if it said no option is right. */
  modelAnswer: number | null;
  problems: Problem[];
  note: string;
}

export interface EvalSummary {
  total: number;
  agreed: number;
  /** Share of questions where the model's blind answer matched the key (0-1). */
  agreement: number;
  /** Questions a person should review: the model disagreed or reported a problem. */
  flagged: EvalResult[];
  byTopic: { topic: string; total: number; agreed: number }[];
}

export function summarizeEval(results: EvalResult[]): EvalSummary {
  const agrees = (r: EvalResult) => r.modelAnswer === r.key;
  const topics = new Map<string, { total: number; agreed: number }>();
  for (const r of results) {
    const t = topics.get(r.topic) ?? { total: 0, agreed: 0 };
    t.total++;
    if (agrees(r)) t.agreed++;
    topics.set(r.topic, t);
  }
  const agreed = results.filter(agrees).length;
  return {
    total: results.length,
    agreed,
    agreement: results.length === 0 ? 0 : agreed / results.length,
    flagged: results.filter((r) => !agrees(r) || r.problems.length > 0),
    byTopic: [...topics].map(([topic, t]) => ({ topic, ...t })).sort((a, b) => a.agreed / a.total - b.agreed / b.total),
  };
}
