import { getBank, SUBJECTS, topicCounts } from "@/lib/bank";

// Public, read-only. The question bank is open data (CC BY 4.0).
export function GET() {
  return Response.json(
    {
      license: "CC BY 4.0 — credit \"ExamPal open UTME question bank\" and link https://github.com/mb1720827-ui/exampal",
      subjects: SUBJECTS.map((s) => ({ id: s.id, name: s.name, questions: getBank(s.id).length, topics: topicCounts(s.id) })),
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}
