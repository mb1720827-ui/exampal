# ExamPal

**Free JAMB UTME practice in Use of English and Mathematics, with a clear explanation for every answer and practice that focuses on each student's weak topics.**

**Live:** https://exampal-chi.vercel.app (no account needed to start practising)

Every year about 2 million Nigerians sit the UTME. Most practise from past-question books that give an answer letter and no reason. ExamPal explains every answer, and it doesn't serve a wrong answer key: each question is verified before it ships.

## What it does

- **Practise in 10-question sessions**, by subject or by single topic, on any phone. No account needed to start.
- **Learn from every answer**: you see straight away whether you were right, and why.
- **Track weak topics**: signed-in students see their accuracy per topic and can practise only the topics they find hardest. Questions they've seen recently are skipped.
- **Light on data**: a whole session is one page load and one save at the end, which matters on slow or expensive connections.

## How the questions are kept correct

A practice app with wrong answers does real harm, so correctness is enforced in three layers:

| Layer | What it does | Where |
|---|---|---|
| **Computed answers** | Maths questions are generated from 18 templates covering 17 UTME syllabus topics. The code works out each answer, so it can't be mis-keyed, and wrong options come from common mistakes (sign errors, forgetting a step). | `src/lib/math.ts` |
| **Independent verification** | Tests regenerate 2,700 maths questions and check every answer a *different* way from the template: substituting roots back into the equation, numerical derivatives and integrals, brute-force counting and so on. | `src/lib/math.test.ts` |
| **Bank checks in CI** | Every question must use a syllabus topic and have four different options, and its explanation must name the correct option. That last rule catches an answer key pointing at the wrong letter. | `src/lib/bank.test.ts` |
| **AI blind-answer eval** | `npm run eval` has Claude answer every question **without seeing the key**, then reports the agreement rate per topic and lists anything it disagreed with or found ambiguous, for a person to review. | `scripts/eval.ts` |

<!-- After the first eval run, add the result here, e.g. "Latest eval: 99.3% answer-key agreement on 280 questions." -->

## Tech stack

Next.js (App Router, Server Actions, Cache Components) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, row-level security) · Claude API (evals) · Zod · Vitest · GitHub Actions

## Design decisions

- **Questions live in the repo, not the database.** They're versioned, reviewed in pull requests and tested in CI. The database stores only each student's answers (`exampal_attempts`), protected by row-level security so students can only read their own.
- **The server decides what counts as correct.** When a session is saved, subject, topic and correctness are looked up from the question bank rather than trusted from the browser.
- **Options are shuffled per session**, so the right answer isn't always in the same place.
- **No AI cost at runtime.** The live app never calls an AI model. AI is used offline to check questions.

## Run it locally

1. Create a free project at [supabase.com](https://supabase.com) and run [`supabase/migrations/20261124000000_exampal_attempts.sql`](supabase/migrations/20261124000000_exampal_attempts.sql) in its SQL Editor.
2. In Supabase, go to Authentication › URL Configuration and add `http://localhost:3000/auth/callback` to the redirect URLs.
3. Copy the environment file and fill in your keys, then start the app:

   ```bash
   cp .env.example .env.local
   npm install
   npm run dev
   ```

## Scripts

```bash
npm test            # all tests, including the question-bank checks
npm run bank        # rebuild src/data/mathematics.json after changing the templates
npm run eval        # AI blind-answer eval (needs ANTHROPIC_API_KEY); try --limit 20 first
```

## Roadmap

- Biology, Physics, Chemistry and Literature
- Comprehension passages and Oral English
- Timed mock exams in the real UTME format

## License

MIT
