"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldMark } from "@/components/ShieldMark";
import { NOT_ELIGIBLE_PATH, STEP_PATHS } from "@/lib/funnel";
import { readFunnel } from "@/lib/funnel-state";
import { quizIncomplete } from "@/lib/quiz";
import { useQuizDefinition } from "@/lib/use-quiz-definition";
import { submitAnswers, type SubmitOutcome } from "@/lib/quiz-submit";

/**
 * What the result screen shows a verified visitor with no score on record.
 *
 * That combination means one thing: the code was accepted and the write after it
 * wasn't. The answers are still in this tab's sessionStorage and the session is still
 * verified, so the missing step is one POST — this screen makes it, rather than
 * sending the user back to `/quiz/questions` to retype seven answers and collect a
 * fresh code for a number that is already proved.
 *
 * Only if the answers really are gone (a new browser, a cleared tab) is the quiz the
 * honest destination.
 *
 * A rarer screen than it used to be. The score write once rode along with the OTP
 * verify, so a blip on it stranded someone whose code was already spent and this was
 * the way out. The submit now happens on its own screen, after sign-in, with its own
 * retry — so reaching here means the write failed and the visitor navigated on anyway.
 * Still worth having: the alternative is a score screen with no score and no way
 * forward.
 */
export function ResumeSave() {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  /* Not for questions — this screen renders none. It judges whether the stored
     answers are still complete, and names the version they go up with. */
  const { quiz, error: definitionError, reload } = useQuizDefinition();
  /* React runs effects twice in development, and this one POSTs. */
  const started = useRef(false);
  /* The in-flight POST, held across those two passes — same reason as the effect in
     `Calculating`, which carries the full explanation. */
  const pending = useRef<Promise<SubmitOutcome> | null>(null);

  const apply = useCallback(
    (outcome: SubmitOutcome) => {
      /* Re-render the server component that sent us here; it reads the score back
         off the record, so this is the whole handoff. */
      if (outcome.ok) return router.refresh();
      // The session went while this tab sat here — back to the number.
      if (outcome.reason === "signed-out") {
        return router.replace(STEP_PATHS.details);
      }
      /* The quiz moved. These answers belong to questions that are no longer
         asked, so retrying the same POST can only fail again — the quiz is the only
         way on, and the session makes it free. */
      if (outcome.reason === "retake") {
        return router.replace(STEP_PATHS["quiz-questions"]);
      }
      /* The API refused an under-18 answer. Retrying would be refused again, so off
         this screen rather than onto its "Try again" panel. `/api/quiz` judges the
         age; this only follows its answer. */
      if (outcome.reason === "not-eligible") {
        return router.replace(NOT_ELIGIBLE_PATH);
      }
      setFailed(outcome.error);
    },
    [router],
  );

  /* `started` guards only the POST, never the whole effect body. Guarding the body
     deadlocks under StrictMode: the second pass returns early, so the first pass's
     request resolves into a `live` its own cleanup has already cleared and the screen
     sits on "Finishing your score" forever. The promise in the ref is what lets each
     pass attach its own handler to the one request. */
  useEffect(() => {
    /* Waits for the definition: it is what completeness is judged against and what
       names the version in the POST. Running early would send a verified visitor with
       perfectly good answers back to question one. */
    if (quiz === null) return;

    let live = true;

    if (!started.current) {
      started.current = true;

      if (quizIncomplete(quiz, readFunnel())) {
        router.replace(STEP_PATHS["quiz-questions"]);
        return;
      }

      pending.current = submitAnswers(quiz.quiz_version);
    }

    pending.current?.then((outcome) => {
      if (live) apply(outcome);
    });

    return () => {
      live = false;
    };
  }, [apply, quiz, router]);

  /* A definition that will not load stalls this screen the same way a failed write
     does, and for the visitor it is the same problem, so it uses the same panel. */
  const stalled = failed ?? (quiz === null ? definitionError : null);

  return (
    <div role="status" className="flex flex-col items-center text-center">
      <ShieldMark monotone className="w-[37px] text-brand" />

      {stalled !== null ? (
        <>
          <h1 className="mt-8 max-w-[420px] text-2xl leading-9 font-bold text-ink">
            We couldn&apos;t finish scoring your quiz
          </h1>
          <p className="mt-4 max-w-[420px] text-base text-ink-muted">
            {stalled} Your number is verified, so nothing needs re-sending.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed(null);
              /* No definition means there is nothing to write yet — re-fetch it and
                 let the effect start the POST, which it will: `started` is still
                 false in that case. */
              if (quiz === null) return reload();
              pending.current = submitAnswers(quiz.quiz_version);
              pending.current.then(apply);
            }}
            className="mt-8 flex h-14 w-full max-w-[317px] items-center justify-center rounded-full bg-brand text-lg font-semibold text-ink-inverse transition-colors hover:bg-cta"
          >
            Try again
          </button>
          {/* The way out if the retry keeps failing: the quiz still has the answers
              and it is the only other route to a score. */}
          <Link
            href={STEP_PATHS["quiz-questions"]}
            className="mt-5 text-sm font-medium text-brand transition-colors hover:opacity-70"
          >
            Start the quiz again
          </Link>
        </>
      ) : (
        <h1 className="mt-8 max-w-[320px] text-2xl leading-9 font-bold text-ink">
          Finishing your Likeness Health Score
          <sup className="align-[2px] text-[0.5em]">SM</sup>
        </h1>
      )}
    </div>
  );
}
