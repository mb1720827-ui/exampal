import { getBank, getSubject } from "@/lib/bank";

const MAX_LIMIT = 100;
const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" };

/**
 * GET /api/v1/questions?subject=mathematics&topic=Indices&limit=20&offset=0
 * Public, read-only, paged. The question bank is open data (CC BY 4.0).
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const subject = getSubject(params.get("subject"));
  if (!subject) {
    return Response.json({ error: "Pass ?subject= with a subject id from /api/v1/subjects" }, { status: 400, headers });
  }
  const topic = params.get("topic");
  if (topic && !subject.topics.includes(topic)) {
    return Response.json({ error: `Unknown topic for ${subject.id}. See /api/v1/subjects` }, { status: 400, headers });
  }
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), MAX_LIMIT);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const matching = getBank(subject.id).filter((q) => !topic || q.topic === topic);
  return Response.json(
    {
      license: "CC BY 4.0 — credit \"ExamPal open UTME question bank\" and link https://github.com/mb1720827-ui/exampal",
      total: matching.length,
      offset,
      limit,
      questions: matching.slice(offset, offset + limit),
    },
    { headers },
  );
}
