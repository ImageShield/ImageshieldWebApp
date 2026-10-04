"use client";

import { readFunnel } from "./funnel-state";

/**
 * Posting the answers, shared by the two screens that do it.
 *
 * `Calculating` does it as the funnel's normal last step. `ResumeSave` does it on the
 * score screen when a signed-in visitor turns out to have no score on record — the
 * write never landed, and re-answering seven questions to fix one failed POST would be
 * absurd. Same request, same outcomes, so it lives here rather than twice.
 *
 * Deliberately setState-free and outside any component. It returns an outcome for the
 * caller to apply from a callback, which is what keeps both screens clear of a
 * synchronous setState inside an effect — the thing that causes cascading renders, and
 * that React's lint rule catches even when the state update is several calls deep.
 */
export type SubmitOutcome =
  | { ok: true }
  /* Split by where each one has to send the visitor, which is the only reason a
     failed POST needs more than one shape. */
  | {
      ok: false;
      reason:
        /** The session went while the quiz was being answered. */
        | "signed-out"
        /** The quiz moved under the visitor — a deploy landed between the questions
         *  being read and the answers being sent. Nothing to retry: the questions
         *  changed. The session is untouched, so they re-answer without a second
         *  code. */
        | "retake"
        /** The API refused an under-18 answer — the funnel is adults-only. Nothing
         *  to retry and nothing to fix from here; the screens send the visitor to
         *  the not-eligible page. */
        | "not-eligible"
        /** Worth trying again from where the visitor stands. */
        | "failed";
      error: string;
    };

/**
 * `quizVersion` is the version of the definition the QUESTIONS were rendered from,
 * passed in by the screen that has it rather than read from a module here. There is no
 * bundled copy to read any more, and a second fetch just to name a version the caller
 * is already holding would be a request for nothing.
 */
export async function submitAnswers(quizVersion: string): Promise<SubmitOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        /* The version these answers were given against. The server re-reads the live
           definition and validates against THAT, so this is only what lets it tell a
           quiz that moved from a malformed body, and name the drift in a log. */
        quizVersion,
        answers: readFunnel().answers,
      }),
    });
  } catch {
    return {
      ok: false,
      reason: "failed",
      error: "We couldn't reach the server. Check your connection.",
    };
  }

  if (response.ok) return { ok: true };

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    retakeQuiz?: boolean;
    notEligible?: boolean;
  };
  const error = body.error ?? "We couldn't save your answers.";

  if (response.status === 401) return { ok: false, reason: "signed-out", error };
  if (body.notEligible === true) return { ok: false, reason: "not-eligible", error };
  if (body.retakeQuiz === true) return { ok: false, reason: "retake", error };
  return { ok: false, reason: "failed", error };
}
