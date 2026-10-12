import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ResumeSave } from "@/components/score/ResumeSave";
import { ScoreResult } from "@/components/score/ScoreResult";
import { SessionRefresh } from "@/components/score/SessionRefresh";
import { STEP_PATHS } from "@/lib/funnel";
import { loadScore } from "@/lib/score-record";

export const metadata: Metadata = {
  title: "ImageShield — Your Likeness Health Score",
};

/** The shell every non-result state renders inside. */
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-canvas-tint px-5 text-center">
      <SiteHeader />
      {children}
    </main>
  );
}

/**
 * The result screen.
 *
 * Rendered on the server off the session cookie, so the score is in the first paint —
 * no spinner, and no window in which the page is mounted without a score to show.
 * That also means it can't be linked to: without a session there is nothing to render
 * and the visitor is sent back into the funnel.
 */
export default async function ScorePage() {
  /* The whole page, risk factors and recommendations included, comes off this one
     read. The quiz definition used to be read here as well, for wording a factor
     the presentation table didn't know; the API words its factors now. */
  const loaded = await loadScore();

  if (!loaded.ok) {
    switch (loaded.reason) {
      /* No session at all — this browser hasn't earned a score yet. */
      case "signed-out":
        redirect(STEP_PATHS.details);

      /* There IS a session; its access token just needs rotating, and a render can't
         write the cookie that would hold the new one. One POST from the browser and
         this page renders again for real. */
      case "stale":
        return (
          <Centred>
            <SessionRefresh />
          </Centred>
        );

      /* Signed in but nothing stored means the answers never landed — the code was
         accepted and the write after it wasn't. The answers are still in the tab and
         the session is still good for the write, so `ResumeSave` makes it from here
         instead of marching the visitor back through the quiz and a second code. */
      case "missing":
        return (
          <Centred>
            <ResumeSave />
          </Centred>
        );

      /* The quiz was retired after these answers were given. There is no write to
         retry — the answers are to questions nobody is asked any more — so the quiz
         is the only honest destination. */
      case "outdated":
        redirect(STEP_PATHS["quiz-questions"]);

      /* Answers are in and the number is still being computed. Emphatically NOT the
         same as `missing`: re-posting the answers here would be wrong. This state
         did not exist on the legacy backend, which scored synchronously. */
      case "pending":
        return (
          <Centred>
            <h1 className="max-w-[420px] text-2xl leading-9 font-bold text-ink">
              Your score is being worked out
            </h1>
            <p className="mt-4 max-w-[420px] text-base text-ink-muted">
              We&apos;ve saved your answers. Your Likeness Health Score
              <sup className="align-[2px] text-[0.5em]">SM</sup> will be ready
              shortly.
            </p>
            <Link
              href={STEP_PATHS.score}
              className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
            >
              Check again
            </Link>
          </Centred>
        );

      /* The API is unreachable. The visitor IS signed in and their score IS saved, so
         sending them back through OTP would be both wrong and rude — the only thing
         missing is this request. Say so and let them retry. */
      case "unavailable":
        return (
          <Centred>
            <h1 className="max-w-[420px] text-2xl leading-9 font-bold text-ink">
              We couldn&apos;t load your score just now
            </h1>
            <p className="mt-4 max-w-[420px] text-base text-ink-muted">
              It&apos;s saved against your account — this is on us. Try again in a
              moment.
            </p>
            <Link
              href={STEP_PATHS.score}
              className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
            >
              Try again
            </Link>
          </Centred>
        );
    }
  }

  return <ScoreResult record={loaded.record} handoff={loaded.handoff} />;
}
