/**
 * The likeness-exposure quiz and the score derived from it.
 *
 * The quiz is DATA, not code. The funnel used to carry its own copy of the questions
 * — mirrored by hand from the app's `LikenessHealthQuizScreen` — and post whatever
 * the visitor picked. `POST /v1/quiz/responses` checks both the KEYS and the VALUES
 * against the active definition and 400s on anything it doesn't recognise, so a
 * hardcoded copy is now a guaranteed rejection the day the server edits a question.
 * Read the definition, render it, send back the `quiz_version` it came with.
 *
 * The score is computed server-side and recomputed when exposure changes. Nothing on
 * this side derives any part of it — see the note on `band` in ../score.ts.
 *
 * The shapes live in ../quiz.ts and ../score.ts because the screens render from them
 * and this module is server-only.
 */
import "server-only";

import type { QuizAnswers, QuizDefinition } from "../quiz";
import type { ScoreEnvelope } from "../score";
import { callAsUser, readAsUser } from "../session";
import { call } from "./client";

/**
 * The active quiz, read with the visitor's session and NOT cached.
 *
 * The API answers this only to a session, which is the whole reason the questions are
 * asked after the phone number rather than before it: an anonymous read gets a 401,
 * and the alternative — rendering a quiz this repo carries its own copy of — is a 400
 * at submit, because both the answer keys and the answer values are validated against
 * whatever the server is actually serving.
 *
 * Uncached on purpose, even though it is the same bytes for every visitor. It carries
 * an Authorization header, and a cache entry keyed loosely enough to be shared would
 * be one visitor's authenticated response served to another. The saving would be a
 * few kilobytes on one screen.
 */
export const readQuizDefinitionAsUser = () =>
  callAsUser<QuizDefinition>("GET", "/v1/quiz");

/**
 * How long a cached definition may be served before it is re-read.
 *
 * The quiz changes when someone edits it, which is rarely and never urgently, so this
 * trades a few minutes of staleness for one API call per window instead of one per
 * screen per visitor. Staleness is survivable by design: the answers are validated
 * against a fresh read at submit, and a mismatch becomes the 409 retake.
 */
const DEFINITION_TTL_S = 300;

/**
 * The active quiz, read WITHOUT a session — the funnel's only source of questions.
 *
 * The funnel asks the quiz before the phone number, so at the moment the questions
 * render there is no token to read them with. That used to make this read impossible
 * and is why this repo carried a hand-copied `quiz-content.ts`; the endpoint is now
 * answered unauthenticated, so the copy is gone and the questions are the server's.
 *
 * Cached, unlike `readQuizDefinitionAsUser` above, and the difference is entirely the
 * token: with no Authorization header there is no visitor in the request, so there is
 * nothing visitor-specific in the response to leak between them. `call` refuses to
 * combine `revalidate` with an access token, so this stays true.
 */
export const readPublicQuizDefinition = () =>
  call<QuizDefinition>("GET", "/v1/quiz", { revalidate: DEFINITION_TTL_S });

/**
 * 201 Created, with the freshly computed score.
 *
 * `quizVersion` pins the answers to the definition they were answered against and is
 * never invented — it comes back from `readQuizDefinition` and rides through the
 * funnel beside the answers. A version the server has retired is a 400, which is the
 * honest outcome: those answers were given to different questions.
 */
export const submitQuizResponses = (
  quizVersion: string,
  answers: QuizAnswers,
) =>
  callAsUser<ScoreEnvelope>("POST", "/v1/quiz/responses", {
    body: { quiz_version: quizVersion, answers },
  });

/**
 * The stored score, for a server component's render.
 *
 * The ONE read on this API allowed to 404 on emptiness, and it says so in a code
 * (`NO_QUIZ_RESPONSE`) rather than a message. `QUIZ_OUTDATED` is the other empty-ish
 * answer: the quiz was taken against a version that has since been retired, so the
 * only way to a current score is to take it again.
 */
export const readScore = () => readAsUser<ScoreEnvelope>("GET", "/v1/me/score");

/** The same read, for a route handler, which may refresh and persist the rotated pair. */
export const fetchScore = () => callAsUser<ScoreEnvelope>("GET", "/v1/me/score");
