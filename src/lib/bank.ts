import { z } from "zod";
import raw from "@/data/bank.generated.json";
import { QuestionSchema, SubjectSchema, type Question, type Subject } from "./questions";

// Built from bank/ by `npm run bank`, which runs automatically before dev, build and test.
const data = z.object({ subjects: SubjectSchema.array(), questions: QuestionSchema.array() }).parse(raw);

const BY_SUBJECT = new Map<string, Question[]>();
for (const q of data.questions) BY_SUBJECT.set(q.subject, [...(BY_SUBJECT.get(q.subject) ?? []), q]);
const BY_ID = new Map(data.questions.map((q) => [q.id, q]));

/** Subjects that have at least one question, in the order of bank/subjects.json. */
export const SUBJECTS: Subject[] = data.subjects.filter((s) => BY_SUBJECT.has(s.id));

export const getSubject = (id: unknown): Subject | undefined => SUBJECTS.find((s) => s.id === id);
export const getBank = (subjectId: string): Question[] => BY_SUBJECT.get(subjectId) ?? [];
export const getQuestion = (id: string): Question | undefined => BY_ID.get(id);
export const allQuestions = (): Question[] => data.questions;

/** A subject's syllabus topics that have questions, with how many each has. */
export function topicCounts(subjectId: string): { topic: string; count: number }[] {
  const subject = getSubject(subjectId);
  const questions = getBank(subjectId);
  return (subject?.topics ?? [])
    .map((topic) => ({ topic, count: questions.filter((q) => q.topic === topic).length }))
    .filter((t) => t.count > 0);
}
