-- The open bank can gain subjects through pull requests, so allow any subject id
-- (the app only saves ids that exist in the bank).
alter table public.exampal_attempts drop constraint if exists exampal_attempts_subject_check;
alter table public.exampal_attempts add constraint exampal_attempts_subject_check
  check (subject ~ '^[a-z][a-z-]{1,39}$');
