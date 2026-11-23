import english from "@/data/english.json";
import mathematics from "@/data/mathematics.json";
import { QuestionSchema, type Question, type SubjectId } from "./questions";

const BANKS: Record<SubjectId, Question[]> = {
  english: QuestionSchema.array().parse(english),
  mathematics: QuestionSchema.array().parse(mathematics),
};

const BY_ID = new Map(Object.values(BANKS).flat().map((q) => [q.id, q]));

export const getBank = (subject: SubjectId): Question[] => BANKS[subject];
export const getQuestion = (id: string): Question | undefined => BY_ID.get(id);
