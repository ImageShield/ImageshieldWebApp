"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldMark } from "@/components/ShieldMark";
import { NOT_ELIGIBLE_PATH, nextPath, STEP_PATHS } from "@/lib/funnel";
import { readFunnel } from "@/lib/funnel-state";
import { quizIncomplete } from "@/lib/quiz";
import { useQuizDefinition } from "@/lib/use-quiz-definition";
import { submitAnswers, type SubmitOutcome } from "@/lib/quiz-submit";

/**
 * Submits the answers, then hands over to the score screen.
 *
 * The quiz is answered several screens back, so by the time this runs the answers have
 * been in sessionStorage for a minute or two and the code entered on the previous
 * screen has bought the session to write them with. This is a real wait, not a staged
 * one — but the floor below still earns its keep: the write usually answers in well
 * under a second, and a loader that appears and vanishes inside 200ms reads as a
 * glitch rather than as progress.
 */
const MIN_HOLD_MS = 1200;

/* The ring is 228° of a 96px circle: r 45.69 + half of the 4.63 stroke lands the
   outer edge exactly on the box. Dashes are in path length, so the visible arc is
   that fraction of the circumference and the gap is the rest. */
const R = 45.69;
const SWEEP = (228 / 360) * 2 * Math.PI * R;
const GAP = 2 * Math.PI * R - SWEEP;

export function Calculating() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  /* Needed for two things here, neither of them rendering questions: judging whether
     the stored answers are complete, and naming the version they were given against
     in the POST. A failure to read it surfaces through the same error panel as a
     failed write, because from where the visitor sits it is the same problem. */
  const { quiz, error: definitionError, reload } = useQuizDefinition();
  /* React runs effects twice in development, and this one writes. */
  const started = useRef(false);
  /* The in-flight write, held across those two passes. See the effect below — this
     ref is what stops the pair of guards from cancelling each other. */
  const pending = useRef<Promise<SubmitOutcome> | null>(null);

  /* Applies an outcome. A `useCallback` rather than inline so the effect below hands
     it to a promise instead of calling setState in its own body — a synchronous
     setState inside an effect is what triggers cascading renders. */
  const apply = useCallback(
    (outcome: SubmitOutcome) => {
      if (outcome.ok) {
        return router.push(nextPath("calculating") ?? STEP_PATHS.score);
      }
      if (outcome.reason === "signed-out") {
        return router.replace(STEP_PATHS.details);
      }
      /* The quiz moved between the questions being read and the answers being sent.
         Back to the quiz — and not back to the details form, which is why `QuizFlow`
         takes `signedIn`: the session survives this, so re-answering costs no second
         code. */
      if (outcome.reason === "retake") {
        return router.replace(STEP_PATHS["quiz-questions"]);
      }
      /* The API refused an under-18 answer. Not an error to retry — the same
         answers would be refused again — so not the panel below either. The age is
         judged by `/api/quiz`, not here; this only follows its answer. */
      if (outcome.reason === "not-eligible") {
        return router.replace(NOT_ELIGIBLE_PATH);
      }
      setError(outcome.error);
    },
    [router],
  );

  /* The floor overlaps the request rather than being added to it, so a slow write
     costs its own time and nothing more. It exists because the write usually answers
     in well under a second, and a loader that appears and vanishes inside 200ms reads
     as a glitch rather than as progress. */
  const run = useCallback(
    (quizVersion: string) =>
      Promise.all([
        submitAnswers(quizVersion),
        new Promise((done) => setTimeout(done, MIN_HOLD_MS)),
      ]).then(([outcome]) => outcome),
    [],
  );

  /**
   * Fires the write once, and applies its outcome to whichever pass is still mounted.
   *
   * The two guards here have to stay separate, and combining them is a deadlock that
   * only shows up in development. React's StrictMode mounts an effect, tears it down,
   * and mounts it again; with `started` guarding the whole body, the second pass
   * returned early — so the request from the first pass resolved into a `live` that
   * its own cleanup had already set false, `apply` was never called, and the loader
   * span forever on a score that had in fact been saved.
   *
   * So `started` guards only the REQUEST, and the promise lives in a ref. Every pass
   * attaches its own handler to that same promise: the first pass's handler is
   * disarmed by its cleanup, the second pass's is live and navigates. One write, one
   * navigation, in development and production alike.
   */
  useEffect(() => {
    /* Nothing happens until the definition lands. It is what the guard below judges
       completeness against and what names the version in the POST, and starting
       without it would bounce a visitor who has answered everything. */
    if (quiz === null) return;

    let live = true;

    if (!started.current) {
      started.current = true;

      /* Read the store directly rather than through `useFunnel`: this runs once, and
         the hook's first value is the empty server snapshot, which would read as an
         abandoned quiz and bounce someone who answered everything. */
      if (quizIncomplete(quiz, readFunnel())) {
        router.replace(STEP_PATHS["quiz-questions"]);
        return;
      }

      pending.current = run(quiz.quiz_version);
    }

    pending.current?.then((outcome) => {
      if (live) apply(outcome);
    });

    return () => {
      live = false;
    };
  }, [apply, quiz, router, run]);

  /* A definition that will not load stalls this screen — the write cannot be made
     without a version to pin it to — so it is reported rather than spun on. Reuses the
     panel below by feeding it the same state; `reload` re-fetches the definition and
     the effect then starts the write on its own. */
  const stalled = error ?? (quiz === null ? definitionError : null);

  if (stalled !== null) {
    return (
      <div className="flex flex-col items-center text-center">
        <ShieldMark monotone className="w-[37px] text-brand" />
        <h1 className="mt-8 max-w-[420px] text-2xl leading-9 font-bold text-ink">
          We couldn&apos;t finish scoring your quiz
        </h1>
        {/* Says what is safe, because it is the question a stalled screen raises:
            the answers are still in this tab and the number is already verified, so
            retrying costs nothing and needs no new code. */}
        <p className="mt-4 max-w-[420px] text-base text-ink-muted">
          {stalled} Your answers are still here and your number is verified — nothing
          needs re-sending.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            /* Two different retries behind one button, because the visitor is looking
               at one problem. With no definition there is nothing to write yet, so the
               retry re-fetches it and the effect picks up from there; `started` is
               still false in that case, so it will. */
            if (quiz === null) return reload();
            pending.current = run(quiz.quiz_version);
            pending.current.then(apply);
          }}
          className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
        >
          Try again
        </button>
        <Link
          href={STEP_PATHS["quiz-questions"]}
          className="mt-5 text-sm font-medium text-brand transition-colors hover:opacity-70"
        >
          Go back to the quiz
        </Link>
      </div>
    );
  }

  return (
    <div role="status" className="flex flex-col items-center">
      <div className="relative flex size-24 items-center justify-center">
        <div
          aria-hidden
          className="absolute -inset-1.5 rounded-full bg-brand-bright opacity-[0.072] blur-[40px]"
        />
        <svg
          viewBox="0 0 96 96"
          aria-hidden
          className="absolute inset-0 size-24 animate-spin text-brand [animation-duration:1.4s]"
        >
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="4.63"
            strokeLinecap="round"
            strokeDasharray={`${SWEEP} ${GAP}`}
            /* Dashes start at 3 o'clock; the design's arc starts at 12. */
            transform="rotate(-90 48 48)"
          />
        </svg>
        <ShieldMark monotone className="relative w-[37px] text-brand" />
      </div>

      <h1 className="mt-8 max-w-[320px] text-center text-2xl leading-9 font-bold tracking-[-0.5px] text-ink">
        Calculating your Likeness Health Score
        {/* Service mark, set so it hangs off the cap line like the design draws it. */}
        <sup className="align-[2px] text-[0.5em]">SM</sup>
      </h1>
    </div>
  );
}
