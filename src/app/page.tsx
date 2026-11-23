import Link from "next/link";
import { Suspense } from "react";
import { getBank } from "@/lib/bank";
import { topicStats, weakTopics, type Attempt } from "@/lib/practice";
import { SUBJECT_IDS, SUBJECTS, TOPICS, type SubjectId } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";
const practiceHref = (subject: SubjectId, extra: Record<string, string> = {}) =>
  `/practice?${new URLSearchParams({ subject, ...extra })}`;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<Header email={null} />}>
        <SignedInHeader />
      </Suspense>

      <section>
        <h1 className="text-3xl font-bold tracking-tight">Practise for JAMB. Learn from every answer.</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Free UTME practice in Use of English and Mathematics, with a clear explanation for every answer. No account
          needed to start.
        </p>
      </section>

      {SUBJECT_IDS.map((subject) => (
        <section key={subject} className={card}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{SUBJECTS[subject]}</h2>
              <p className="text-sm text-zinc-500">{getBank(subject).length} questions</p>
            </div>
            <Link
              href={practiceHref(subject)}
              className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white hover:bg-emerald-800"
            >
              Start 10 questions
            </Link>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">Practise one topic</summary>
            <ul className="mt-3 flex flex-wrap gap-2">
              {TOPICS[subject].map((topic) => (
                <li key={topic}>
                  <Link
                    href={practiceHref(subject, { topic })}
                    className="block rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-emerald-600 dark:border-zinc-700"
                  >
                    {topic}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}

      <Suspense fallback={null}>
        <Progress />
      </Suspense>

      <footer className="pt-2 text-xs leading-relaxed text-zinc-500">
        Maths answers are computed by code and English questions are checked automatically before they reach you.
        Spotted a mistake? Tell us on{" "}
        <a href="https://github.com/mb1720827-ui/exampal/issues" className="underline">
          GitHub
        </a>
        .
      </footer>
    </main>
  );
}

function Header({ email }: { email: string | null }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/" className="text-xl font-bold tracking-tight">
        Exam<span className="text-emerald-700 dark:text-emerald-400">Pal</span>
      </Link>
      {email ? (
        <form action={signOut} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="hidden max-w-48 truncate sm:inline">{email}</span>
          <button className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/login" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Sign in
        </Link>
      )}
    </header>
  );
}

async function SignedInHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <Header email={user?.email ?? null} />;
}

async function Progress() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <section className={`${card} text-sm text-zinc-600 dark:text-zinc-400`}>
        <Link href="/login" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          Sign in
        </Link>{" "}
        to save your progress and practise the topics you find hardest.
      </section>
    );
  }

  const { data } = await supabase
    .from("exampal_attempts")
    .select("subject, question_id, topic, correct")
    .order("answered_at", { ascending: false })
    .limit(1000);
  const rows = data ?? [];
  if (rows.length === 0) {
    return <section className={`${card} text-sm text-zinc-500`}>Finish a practice session to see your progress here.</section>;
  }

  return (
    <section className={card}>
      <h2 className="text-lg font-semibold">Your progress</h2>
      {SUBJECT_IDS.map((subject) => {
        const attempts: Attempt[] = rows
          .filter((r) => r.subject === subject)
          .map((r) => ({ questionId: r.question_id, topic: r.topic, correct: r.correct }));
        if (attempts.length === 0) return null;
        const stats = topicStats(attempts);
        const weak = weakTopics(stats);
        const overall = attempts.filter((a) => a.correct).length / attempts.length;
        return (
          <div key={subject} className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium">{SUBJECTS[subject]}</h3>
              <span className="text-sm text-zinc-500">
                {Math.round(overall * 100)}% of {attempts.length} answers
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {stats.slice(0, 5).map((s) => (
                <li key={s.topic} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="truncate">{s.topic}</span>
                  <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <span
                      className={`block h-2 rounded-full ${s.accuracy < 0.6 ? "bg-amber-500" : "bg-emerald-600"}`}
                      style={{ width: `${Math.max(4, s.accuracy * 100)}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{Math.round(s.accuracy * 100)}%</span>
                </li>
              ))}
            </ul>
            {weak.length > 0 && (
              <Link
                href={practiceHref(subject, { mode: "weak" })}
                className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
              >
                Practise my weak topics ({weak.length})
              </Link>
            )}
          </div>
        );
      })}
    </section>
  );
}
