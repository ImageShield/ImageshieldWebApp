import "server-only";

import { handoffFor, type Handoff } from "./handoff";
import type { ScoreEnvelope, ScoreRecord } from "./score";
import { SessionUnavailable } from "./session";
import { ApiFailure } from "./v1/errors";
import { firstNameOf, readMe } from "./v1/me";
import { readScore } from "./v1/quiz";

/**
 * Reads a signed-in visitor's stored score.
 *
 * Shared by the result screen and `GET /api/score` so there is one definition of what
 * "this browser's score" means. Neither call takes an identifier — /v1 answers for
 * whoever the bearer token belongs to — which is what replaced the phone number the
 * legacy version had to carry in a signed cookie and paste into a query string.
 *
 * Read back rather than carried over from the submit response so a reloaded or
 * re-shared tab still works, and so a score that has since moved (monitoring found
 * something) shows its current value.
 */
export type ScoreLoad =
  | { ok: true; record: ScoreRecord; handoff: Handoff }
  /* Split apart because the funnel sends them to different places. */
  | {
      ok: false;
      reason:
        /** No session in this browser at all — back to the details form. */
        | "signed-out"
        /** There is a session, but its access token needs rotating and a render
         *  cannot write cookies. One POST to /api/session/refresh fixes it. */
        | "stale"
        /** Authenticated, no quiz response stored — the answers never landed. */
        | "missing"
        /** Answered against a quiz version the server has retired. Only a retake
         *  produces a current score; there is nothing to retry. */
        | "outdated"
        /** Answers are banked and the number isn't ready yet. Not a failure. */
        | "pending"
        /** The API is unreachable. Everything is saved; this request isn't. */
        | "unavailable";
    };

export async function loadScore(): Promise<ScoreLoad> {
  try {
    /* In parallel: neither depends on the other, and this pair is the whole render.
       A failure in either lands in the same catch, and the codes below say which. */
    const [me, envelope] = await Promise.all([readMe(), readScore()]);
    return resolve(firstNameOf(me), envelope);
  } catch (error) {
    if (error instanceof SessionUnavailable) {
      return { ok: false, reason: error.reason };
    }
    if (error instanceof ApiFailure) {
      /* The one read allowed to 404 on emptiness, and it names the emptiness rather
         than leaving the status to be interpreted. */
      if (error.code === "NO_QUIZ_RESPONSE") return { ok: false, reason: "missing" };
      if (error.code === "QUIZ_OUTDATED") return { ok: false, reason: "outdated" };
      console.error("score fetch failed", error.code, error.message);
      return { ok: false, reason: "unavailable" };
    }

    /* Anything that is not this API failing is rethrown, and that is not tidiness.
       `cookies()` throws a DynamicServerError during static generation — it is how
       Next signals "this route can't be prerendered" — and a catch-all here swallowed
       it, reporting a framework control-flow signal to the visitor as "we couldn't
       load your score". A bug in this file would have been hidden the same way. */
    throw error;
  }
}

function resolve(firstName: string, envelope: ScoreEnvelope): ScoreLoad {
  /* 200 with `score: null` means the answers are in and the number is still being
     computed. The legacy backend had no such state — it scored synchronously — so
     this is new, and it is emphatically not "missing": re-posting the answers would
     be wrong. */
  if (envelope.score === null) return { ok: false, reason: "pending" };

  return {
    ok: true,
    record: {
      score: envelope.score,
      scopeNote: envelope.scope_note,
      firstName,
    },
    handoff: handoffFor(),
  };
}
