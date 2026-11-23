"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getQuestion } from "@/lib/bank";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
  /** What the user typed, so a failed submit doesn't wipe the field (React resets forms after actions). */
  value?: string;
}

export async function authenticate(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    return { error: "Enter your email and a password of at least 8 characters.", value: email };
  }

  const supabase = await createClient();
  if (formData.get("intent") === "signup") {
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { error: error.message, value: email };
    if (!data.session) return { message: "Check your email and click the link to confirm your account.", value: email };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, value: email };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const Answers = z
  .array(z.object({ questionId: z.string().max(64), chosen: z.string().max(200) }))
  .min(1)
  .max(20);

/**
 * Saves a finished practice session in one request (kind to slow connections).
 * Subject, topic and correctness are worked out from the question bank, never taken from the browser.
 */
export async function saveAttempts(input: z.input<typeof Answers>): Promise<{ ok: boolean }> {
  const parsed = Answers.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const rows = parsed.data.flatMap(({ questionId, chosen }) => {
    const q = getQuestion(questionId);
    if (!q) return [];
    return [{ question_id: q.id, subject: q.subject, topic: q.topic, correct: q.options[q.answer] === chosen }];
  });
  if (rows.length === 0) return { ok: false };

  const { error } = await supabase.from("exampal_attempts").insert(rows);
  if (error) console.error("Save attempts failed", error);
  return { ok: !error };
}
