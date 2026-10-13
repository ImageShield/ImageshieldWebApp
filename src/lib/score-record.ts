import "server-only";

import { handoffFor, type Handoff } from "./handoff";
import { describeRecord, localInsights, shapeOf } from "./local-insights/engine";
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

/** TEMPORARY — see `resolve`. A field the backend hasn't filled with research yet. */
function awaitsResearch(field: unknown): boolean {
  return field === undefined || field === null || (Array.isArray(field) && field.length === 0);
}

function resolve(firstName: string, envelope: ScoreEnvelope): ScoreLoad {
  /* 200 with `score: null` means the answers are in and the number is still being
     computed. The legacy backend had no such state — it scored synchronously — so
     this is new, and it is emphatically not "missing": re-posting the answers would
     be wrong. */
  if (envelope.score === null) return { ok: false, reason: "pending" };

  const { score } = envelope;

  /* Where each card comes from — the one place that decides, and the migration
     boundary.

     TEMPORARY FALLBACK, until the backend publishes researched insight data. Prod's
     API already sends both fields, but as empty lists while its research hasn't run
     there; taken at its word, that hid both cards from every visitor. So each field
     is decided on its own:

       a non-empty list    the API's. Checked against the contract on the way in, as
                           it always was, and never added to, reordered or replaced.
       absent, null or []  this record's local insights (./local-insights), which may
                           themselves be empty — and then the card stays hidden.
       anything else       a contract breach, not an absence: still the API's, so its
                           validator logs it and the card hides.

     The two sources are never mixed within one field. Once the backend's lists carry
     research this becomes "the API's, always", and ./local-insights goes. Agreed
     2026-10-13; don't change this precedence without an explicit decision. */
  const localRisk = awaitsResearch(score.risk_factors);
  const localRecommendations = awaitsResearch(envelope.general_recommendations);
  const local = localRisk || localRecommendations ? localInsights(score) : null;

  const riskFactors = localRisk
    ? (local?.riskFactors ?? [])
    : riskFactorsFrom(score.risk_factors);
  const recommendations = localRecommendations
    ? (local?.recommendations ?? [])
    : recommendationsFrom(envelope.general_recommendations);

  /* Development only, and structure only: which source each card took and how many
     rows it got, what the API sent for each field, and the shape of the saved
     answers. A card that comes back empty otherwise leaves nothing to say why. Goes
     with the local engine. */
  if (process.env.NODE_ENV === "development") {
    console.info(
      `score cards: risk_factors ${shapeOf(score.risk_factors)} -> ${localRisk ? "local" : "api"} ${riskFactors.length} rows; ` +
        `general_recommendations ${shapeOf(envelope.general_recommendations)} -> ${localRecommendations ? "local" : "api"} ${recommendations.length} rows; ` +
        describeRecord(score),
    );
    /* TEMPORARY, development only: the gender investigation of 2026-10-13. Which saved
       score this render used (its `computed_at`), every gender value in its breakdown
       (two would mean a duplicate key), and the gender row it produced. Nothing else
       from the record. Remove once the mismatch report is closed. */
    const genders = Array.isArray(score.breakdown?.quiz)
      ? score.breakdown.quiz.filter((entry) => entry?.key === "gender").map((entry) => entry.value)
      : [];
    console.info(
      `score cards gender: record computed_at ${score.computed_at}; saved gender ${JSON.stringify(genders)}; ` +
        `factor ${riskFactors.find((factor) => factor.key === "gender")?.title ?? "none"} (${localRisk ? "local" : "api"})`,
    );
  }

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
