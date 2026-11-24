import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getBank, getSubject } from "@/lib/bank";
import { pickQuestions, topicStats, weakTopics, type Attempt } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { PracticeSession } from "./practice-session";

const QUESTIONS_PER_SESSION = 10;

export default function PracticePage({ searchParams }: PageProps<"/practice">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6">
      <Suspense fallback={<p className="text-zinc-500">Loading questions…</p>}>
        <Practice searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Practice({ searchParams }: Pick<PageProps<"/practice">, "searchParams">) {
  const params = await searchParams;
  const found = getSubject(params.subject);
  if (!found) {
    return (
      <p>
        Choose a subject on the{" "}
        <Link href="/" className="text-emerald-700 underline">
          home page
        </Link>
        .
      </p>
    );
  }
  const { id: subject, name } = found;
  const topic = typeof params.topic === "string" && found.topics.includes(params.topic) ? params.topic : undefined;
  const weakMode = params.mode === "weak";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let focus: string[] = [];
  let recent = new Set<string>();
  if (user) {
    const { data } = await supabase
      .from("exampal_attempts")
      .select("question_id, topic, correct")
      .eq("subject", subject)
      .order("answered_at", { ascending: false })
      .limit(500);
    const attempts: Attempt[] = (data ?? []).map((r) => ({ questionId: r.question_id, topic: r.topic, correct: r.correct }));
    recent = new Set(attempts.slice(0, 60).map((a) => a.questionId));
    if (weakMode) focus = weakTopics(topicStats(attempts));
  }

  await connection(); // a fresh random set on every visit
  const questions = pickQuestions(getBank(subject), Math.random, { count: QUESTIONS_PER_SESSION, topic, focus, recent });
  const detail = topic ?? (focus.length > 0 ? "Your weak topics" : null);

  return (
    <PracticeSession
      key={questions.map((q) => q.id).join()}
      questions={questions}
      title={detail ? `${name} · ${detail}` : name}
      signedIn={Boolean(user)}
    />
  );
}
