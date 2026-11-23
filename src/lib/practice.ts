import type { Question } from "./questions";
import { shuffle, type Rng } from "./rng";

export interface Attempt {
  questionId: string;
  topic: string;
  correct: boolean;
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

const MIN_ATTEMPTS_FOR_WEAK = 3;
const WEAK_BELOW = 0.6;

/** Per-topic accuracy, weakest first. */
export function topicStats(attempts: Attempt[]): TopicStat[] {
  const byTopic = new Map<string, { attempts: number; correct: number }>();
  for (const a of attempts) {
    const s = byTopic.get(a.topic) ?? { attempts: 0, correct: 0 };
    s.attempts++;
    if (a.correct) s.correct++;
    byTopic.set(a.topic, s);
  }
  return [...byTopic]
    .map(([topic, s]) => ({ topic, ...s, accuracy: s.correct / s.attempts }))
    .sort((x, y) => x.accuracy - y.accuracy || y.attempts - x.attempts);
}

/** Topics with enough attempts to judge and an accuracy under 60%. */
export const weakTopics = (stats: TopicStat[]) =>
  stats.filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_WEAK && s.accuracy < WEAK_BELOW).map((s) => s.topic);

export interface PickOptions {
  count: number;
  topic?: string;
  /** Focus on these topics when there are enough questions in them. */
  focus?: string[];
  /** Recently answered question ids, used only if there are enough fresh questions. */
  recent?: Set<string>;
}

/** Chooses a practice set and shuffles each question's options so the right answer isn't always in the same place. */
export function pickQuestions(bank: Question[], rng: Rng, { count, topic, focus, recent }: PickOptions): Question[] {
  let pool = topic ? bank.filter((q) => q.topic === topic) : bank;
  if (focus && focus.length > 0) {
    const focused = pool.filter((q) => focus.includes(q.topic));
    if (focused.length >= count) pool = focused;
  }
  if (recent && recent.size > 0) {
    const fresh = pool.filter((q) => !recent.has(q.id));
    if (fresh.length >= count) pool = fresh;
  }
  return shuffle(rng, pool)
    .slice(0, count)
    .map((q) => {
      const order = shuffle(rng, [0, 1, 2, 3]);
      return { ...q, options: order.map((i) => q.options[i]) as Question["options"], answer: order.indexOf(q.answer) };
    });
}
