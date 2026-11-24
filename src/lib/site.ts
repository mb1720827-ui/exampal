export const REPO_URL = "https://github.com/mb1720827-ui/exampal";

/** Opens a prefilled GitHub issue so a student can report a wrong or unclear question in a few taps. */
export function reportMistakeUrl(questionId: string): string {
  const params = new URLSearchParams({
    template: "report-mistake.yml",
    title: `Mistake in ${questionId}`,
    "question-id": questionId,
  });
  return `${REPO_URL}/issues/new?${params}`;
}
