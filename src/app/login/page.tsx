import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <Link href="/" className="text-xl font-bold tracking-tight">
          Exam<span className="text-emerald-700 dark:text-emerald-400">Pal</span>
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Save your progress</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          With an account, ExamPal remembers what you got wrong and helps you practise your weak topics.
        </p>
      </div>
      <Suspense fallback={null}>
        <ConfirmError searchParams={searchParams} />
      </Suspense>
      <AuthForm />
    </main>
  );
}

async function ConfirmError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (error !== "confirm") return null;
  return (
    <p role="alert" className="text-sm text-rose-600">
      That confirmation link didn&apos;t work. It may have expired, so try signing up again.
    </p>
  );
}
