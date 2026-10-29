import "server-only";

import { handoffFor, type Handoff } from "./handoff";
import { recommendationsFrom } from "./recommendations";
import { riskFactorsFrom, type ScoreEnvelope, type ScoreRecord } from "./score";
import { SessionUnavailable } from "./session";
import { ApiFailure } from "./v1/errors";
import { firstNameOf, readMe, storedScoreOf, type Me } from "./v1/me";
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
        /** Authenticated, no quiz response stored and no score on the account — the
         *  answers never landed. */
        | "missing"
        /** Answered against a quiz version the server has retired, AND the account
         *  has no stored score to show instead. Only a retake produces one. */
        | "outdated"
        /** Answers are banked and the number isn't ready yet. Not a failure. */
        | "pending"
        /** The API is unreachable. Everything is saved; this request isn't. */
        | "unavailable";
    };

export async function loadScore(): Promise<ScoreLoad> {
  try {
    /* In parallel: neither depends on the other, and this pair is the whole render.
       A failure in either lands in the same catch, and the codes below say which —
       except the two 404s that mean "no current response", which come back as their
       code so the account read beside it can answer them. */
    const [me, envelope] = await Promise.all([
      readMe(),
      readScore().catch((error: unknown) => {
        if (
          error instanceof ApiFailure &&
          (error.code === "NO_QUIZ_RESPONSE" || error.code === "QUIZ_OUTDATED")
        ) {
          return error.code;
        }
        throw error;
      }),
    ]);
    if (typeof envelope === "string") return resolveFromAccount(me, envelope);
    return resolve(firstNameOf(me), envelope);
  } catch (error) {
    if (error instanceof SessionUnavailable) {
      return { ok: false, reason: error.reason };
    }
    if (error instanceof ApiFailure) {
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

  const { score } = envelope;

  const riskFactors = riskFactorsFrom(score.risk_factors);
  const recommendations = recommendationsFrom(envelope.general_recommendations);

  return {
    ok: true,
    record: {
      score,
      scopeNote: envelope.scope_note,
      firstName,
      riskFactors,
      recommendations,
    },
    handoff: handoffFor(),
  };
}

/**
 * `/v1/me/score` has no current response — never taken (NO_QUIZ_RESPONSE), or
 * answered against a retired version (QUIZ_OUTDATED). If the account still carries a
 * score, that is what is shown, rather than resuming the write or sending the visitor
 * to retake the quiz, either of which would replace it. `/api/quiz` makes the same
 * call through `hasScoreOnRecord`, so this screen never resumes a write that route
 * would refuse.
 *
 * No `scope_note`, risk factors or recommendations come with it (those are attached to
 * `/v1/me/score` answers only), and none is invented here; the screen simply shows
 * none. Only an account with no number at all goes on to resume (`missing`) or
 * retake (`outdated`).
 */
function resolveFromAccount(
  me: Me,
  code: "NO_QUIZ_RESPONSE" | "QUIZ_OUTDATED",
): ScoreLoad {
  const stored = storedScoreOf(me);
  if (stored === null) {
    return { ok: false, reason: code === "QUIZ_OUTDATED" ? "outdated" : "missing" };
  }

  return {
    ok: true,
    record: {
      score: stored,
      scopeNote: "",
      firstName: firstNameOf(me),
      riskFactors: [],
      recommendations: [],
    },
    handoff: handoffFor(),
  };
}
