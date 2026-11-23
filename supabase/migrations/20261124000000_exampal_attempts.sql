-- ExamPal: one row per answered question, so students can see their weak topics.
-- The questions themselves live in the repo (src/data), not the database.
-- Run once in the Supabase SQL Editor (safe to re-run).

create table if not exists public.exampal_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 64),
  subject text not null check (subject in ('english', 'mathematics')),
  topic text not null check (char_length(topic) <= 64),
  correct boolean not null,
  answered_at timestamptz not null default now()
);

create index if not exists exampal_attempts_user_idx
  on public.exampal_attempts (user_id, subject, answered_at desc);

alter table public.exampal_attempts enable row level security;

drop policy if exists "Students read their own attempts" on public.exampal_attempts;
create policy "Students read their own attempts"
  on public.exampal_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Students add their own attempts" on public.exampal_attempts;
create policy "Students add their own attempts"
  on public.exampal_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);
