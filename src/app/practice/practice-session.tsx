"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LETTERS, type Question } from "@/lib/questions";
import { saveAttempts } from "../actions";

interface Props {
  questions: Question[];
  title: string;
  signedIn: boolean;
}

export function PracticeSession({ questions, title, signedIn }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const [saved, setSaved] = useState<"idle" | "saved" | "failed">("idle");
  const savedOnce = useRef(false);

  const done = index >= questions.length;
  const score = chosen.filter((c, i) => c === questions[i].answer).length;

  // Save once, when the last question is answered, so a whole session costs one request.
  useEffect(() => {
    if (!done || !signedIn || savedOnce.current) return;
    savedOnce.current = true;
    saveAttempts(questions.map((q, i) => ({ questionId: q.id, chosen: q.options[chosen[i] ?? 0] })))
      .then((r) => setSaved(r.ok ? "saved" : "failed"))
      .catch(() => setSaved("failed"));
  }, [done, signedIn, questions, chosen]);

  if (done) {
    const missedTopics = [...new Set(questions.filter((q, i) => chosen[i] !== q.answer).map((q) => q.topic))];
    return (
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>
          <h1 className="mt-1 text-3xl font-bold">
            {score} / {questions.length}
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{feedback(score / questions.length)}</p>
        </div>
        {missedTopics.length > 0 && (
          <div>
            <h2 className="font-semibold">Topics to revise</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missedTopics.map((t) => (
                <li key={t} className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        {signedIn ? (
          <p className="text-sm text-zinc-500" role="status">
            {saved === "saved" ? "Progress saved." : saved === "failed" ? "Couldn't save your progress this time." : "Saving progress…"}
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/login" className="font-medium text-emerald-700 underline dark:text-emerald-400">
              Sign in
            </Link>{" "}
            to track your weak topics across sessions.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              window.scrollTo(0, 0);
              router.refresh(); // the server picks a fresh random set
            }}
            className="rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800"
          >
            Practise again
          </button>
          <Link href="/" className="rounded-lg border border-zinc-300 px-4 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const picked = chosen[index];
  const answered = picked !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>{title}</span>
        <span>
          {index + 1} of {questions.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{q.topic}</p>
        <p className="mt-2 whitespace-pre-wrap text-lg leading-relaxed">{q.stem}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answer;
          const state = !answered ? "idle" : isAnswer ? "right" : i === picked ? "wrong" : "dim";
          return (
            <li key={i}>
              <button
                onClick={() => setChosen((c) => c.map((v, j) => (j === index ? i : v)))}
                disabled={answered}
                aria-label={`Option ${LETTERS[i]}: ${option}`}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                  {
                    idle: "border-zinc-300 hover:border-emerald-600 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-950",
                    right: "border-emerald-600 bg-emerald-50 dark:bg-emerald-950",
                    wrong: "border-rose-500 bg-rose-50 dark:bg-rose-950",
                    dim: "border-zinc-200 opacity-60 dark:border-zinc-800",
                  }[state]
                }`}
              >
                <span className="font-semibold">{LETTERS[i]}.</span>
                <span className="flex-1">{option}</span>
                {state === "right" && <span aria-hidden>✓</span>}
                {state === "wrong" && <span aria-hidden>✗</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {answered && (
        <div className="flex flex-col gap-4">
          <div
            role="status"
            className={`rounded-xl p-4 ${picked === q.answer ? "bg-emerald-50 dark:bg-emerald-950" : "bg-amber-50 dark:bg-amber-950"}`}
          >
            <p className="font-semibold">{picked === q.answer ? "Correct!" : `The answer is ${LETTERS[q.answer]}.`}</p>
            <p className="mt-1 leading-relaxed text-zinc-700 dark:text-zinc-300">{q.explanation}</p>
          </div>
          <button
            onClick={() => setIndex((n) => n + 1)}
            autoFocus
            className="rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white hover:bg-emerald-800"
          >
            {index + 1 === questions.length ? "See my score" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}

function feedback(ratio: number) {
  if (ratio >= 0.8) return "Excellent work. Keep it up!";
  if (ratio >= 0.6) return "Good effort. Revise the topics below and try again.";
  return "Keep practising. Every attempt shows you what to revise next.";
}
