# ExamPal: the open UTME question bank

**An open, verified bank of JAMB UTME practice questions that anyone can use, check and improve, plus a free practice app built on it.**

**Practice app:** https://exampal-chi.vercel.app · **Questions:** [`bank/`](bank/) · **API:** [`/api/v1/subjects`](https://exampal-chi.vercel.app/api/v1/subjects) · **Licence:** questions CC BY 4.0, code MIT

Every year about 2 million Nigerians sit the UTME. Most practise from past-question books that are copyrighted, full of mis-keyed answers and give no reasons. This bank is the opposite:

- **Open:** free to reuse in any app, website or class, with credit (CC BY 4.0).
- **Verified:** every question passes automated checks before it's merged, and maths answers are computed by code.
- **Explained:** every answer comes with a short explanation.
- **Community-built:** teachers and students add questions by pull request (or a plain-English form) and are credited in the app.

## What's in it

| Subject | Questions | How |
|---|---|---|
| Use of English | 64 across 7 topics | Hand-written |
| Mathematics | 216 across 17 topics | Generated from 18 templates with computed answers |
| Physics, Chemistry, Biology… | [Help wanted](CONTRIBUTING.md#adding-a-new-subject) | |

## Use the bank

**In your own code:** the questions are plain JSON in [`bank/`](bank/), one file per topic.

**Through the API:**

```bash
curl "https://exampal-chi.vercel.app/api/v1/subjects"
curl "https://exampal-chi.vercel.app/api/v1/questions?subject=mathematics&topic=Indices&limit=20"
```

Each question has `stem`, four `options`, `answer` (0–3), `explanation`, `topic` and, for hand-written questions, `author`. Credit: *"Questions from the ExamPal open UTME question bank, CC BY 4.0"*, with a link to this repo.

## Contribute

Add questions, fix mistakes or add a whole subject. See **[CONTRIBUTING.md](CONTRIBUTING.md)**. No JSON experience? Use the [Suggest questions form](https://github.com/mb1720827-ui/exampal/issues/new?template=suggest-questions.yml). Students can tap **Report a mistake** under any question in the app.

## How questions are kept correct

A wrong answer key does real harm to a student, so correctness is enforced in layers:

| Layer | What it does | Where |
|---|---|---|
| **Contributor checks** | `npm run check` validates every question and explains problems in plain words: unknown fields, topics outside the syllabus, duplicates, repeated options, and explanations that don't name the correct option (which catches mis-keyed answers). It runs on every pull request. | `src/lib/load-bank.ts` |
| **Computed answers** | Maths questions are generated from templates; the code works out each answer and builds wrong options from common mistakes. | `src/lib/math.ts` |
| **Independent verification** | Tests regenerate 2,700 maths questions and check every answer a different way: substituting roots, numerical calculus, brute-force counting. | `src/lib/math.test.ts` |
| **AI blind-answer eval** | `npm run eval` has Claude answer each question **without seeing the key** and reports agreement per topic, plus anything to review. | `scripts/eval.ts` |
| **AI question factory** | `npm run factory` has Claude Code draft questions for one syllabus topic. A separate run answers them blind, and only the questions it agrees with that also pass `npm run check` are kept. `--pr` opens a pull request so a person reviews each one before students see it, labelled "Drafted by AI". | `scripts/factory.ts` |

## The practice app

- 10-question sessions by subject or topic, on any phone, with no account needed.
- Instant feedback with an explanation, credit for the question's author and a **Report a mistake** link.
- Signed-in students track accuracy per topic and practise their **weak topics**. Recently seen questions are skipped.
- Light on data: one page load and one save per session.

**Architecture:** the bank is compiled from `bank/` at build time (`npm run bank`, run automatically before dev, build and test), so the live app needs no database for questions and never calls an AI model. Supabase stores only each student's answers, protected by row-level security. Subject, topic and correctness are worked out on the server from the bank, never trusted from the browser.

## Tech stack

Next.js (App Router, Server Actions, Cache Components) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, row-level security) · Claude API and Claude Code (evals, question factory) · Zod · Vitest · GitHub Actions

## Run it locally

1. Create a free project at [supabase.com](https://supabase.com) and run the SQL files in [`supabase/migrations/`](supabase/migrations/) in its SQL Editor.
2. In Supabase, go to Authentication › URL Configuration and add `http://localhost:3000/auth/callback` to the redirect URLs.
3. Then:

   ```bash
   cp .env.example .env.local   # fill in your Supabase URL and publishable key
   npm install
   npm run dev
   ```

```bash
npm run check   # validate the question bank
npm test        # all tests
npm run eval    # AI blind-answer eval (needs ANTHROPIC_API_KEY); try --limit 20 first
npm run factory -- --subject physics --topic "Motion" --pr   # draft, blind-check, open a PR (uses your Claude Code login)
```

## Licence

Questions (`bank/` and generated maths questions): [CC BY 4.0](bank/LICENSE). Code: [MIT](LICENSE).
