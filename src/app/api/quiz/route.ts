import { declaresMinor, validateAnswers } from "@/lib/quiz";
import { noteVersionDrift, readLiveQuizDefinition } from "@/lib/quiz-definition";
import { saveQuizAnswers } from "@/lib/quiz-save";
import { allowPerIp } from "@/lib/rate-limit";
import { readSession, SessionUnavailable } from "@/lib/session";
import { presentableFailure } from "@/lib/v1/errors";

/**
 * POST /api/quiz — { quizVersion, answers }
 *
 * The funnel's score write, and the only one. The quiz is answered before the phone
 * number — the answers sit in the browser through the details form and the code — so
 * this runs on `/calculating`, the first screen with a session to write them with.
 *
 * It is deliberately not part of `/api/otp/verify`, which is where this write used to
 * live. A /v1 challenge is spent the moment it is accepted, so a write bundled into
 * the verify that then failed stranded someone with a dead code and nothing to retype.
 * Here, a failed write is just a failed write: the session outlives it, and both
 * `/calculating` and the score screen retry against that same session.
 *
 * This is also where a quiz that moved mid-funnel is caught. The questions the visitor
 * answered were fetched when they started, so the re-read below is the only thing
 * standing between a definition that has changed since and a bare 400 — see the 409 it
 * turns that into.
 *
 * Nothing in the body says whose record this is. It cannot: the API takes the person
 * from the bearer token.
 */
export async function POST(request: Request) {
  /* Cheap pre-check so a signed-out browser is turned away without a round trip.
     The real gate is the API, which is the only thing that can tell a live session
     from a revoked one. */
  if ((await readSession()) === null) {
    return Response.json(
      { error: "Your session expired. Start again." },
      { status: 401 },
    );
  }

  let body: { quizVersion?: unknown; answers?: unknown };
  try {
    body = (await request.json()) as { quizVersion?: unknown; answers?: unknown };
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  /* Counted BEFORE either API call below, which is the whole point of its position:
     this route reads the definition and then writes a score, so an unchecked retry
     loop would be two calls per request rather than one. Counted per address, because
     /v1 hands out no identifier to key on and the session's tokens rotate, so nothing
     in the cookie is stable enough to be a bucket. Loose enough that a visitor tapping
     "Try again" at a genuinely flaky moment never meets it, and a shared address still
     gets far more retries than a real recovery needs. */
  if (!allowPerIp(request, "quiz", 30, 10 * 60 * 1000)) {
    return Response.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  /* Re-read rather than trusting the version the client sent. The screen that rendered
     these questions rendered them from this repo's own copy, so the client's version
     string is a claim about that copy and nothing more — this is the one place that
     can ask the server what it is actually serving. The answers are validated against
     what comes back and pinned to its version, so a local quiz that has fallen behind
     is caught here rather than stored wrong. */
  let live;
  try {
    live = await readLiveQuizDefinition();
  } catch (error) {
    if (error instanceof SessionUnavailable) {
      return Response.json(
        { error: "Your session expired. Start again." },
        { status: 401 },
      );
    }
    console.error("live quiz definition unavailable", (error as Error).message);
    return Response.json(
      { error: "We couldn't load the quiz just now. Please try again." },
      { status: 502 },
    );
  }
  noteVersionDrift(body?.quizVersion, live);

  const parsed = validateAnswers(live, body?.answers);
  if (!parsed.ok) {
    /* Answers that fitted the definition the visitor was served but not the one the
       server has now. There is no write to retry — these are answers to different
       questions. The session is untouched, so the retake below costs the visitor
       answers and not a second code; `QuizFlow` routes them straight back to
       `/calculating` when they are done. */
    console.warn("answers no longer fit the live quiz", parsed.error);
    return Response.json(
      {
        error: "The quiz has been updated. Please answer it again.",
        retakeQuiz: true,
      },
      { status: 409 },
    );
  }

  /* Adults only, and this is where the web enforces it with authority: the one place
     the age answer reaches this server, ahead of the write. The quiz, details and OTP
     screens all turn an under-18 answer away, but they run in the browser — this is
     what stops it reaching the scorer from anywhere else: `/calculating` opened by
     hand, the score screen's resume, or a request made directly. Checked against the
     validated answers, so it judges exactly what would have been written; nothing is
     sent to the API and the record's existing score is left as it was.

     403 with a flag beside `error`, the same shape as the 409's `retakeQuiz` above,
     so `submitAnswers` can route on it rather than on a status code. */
  if (declaresMinor(parsed.answers)) {
    return Response.json(
      {
        error: "The Likeness Health Score is only available to people aged 18 and over.",
        notEligible: true,
      },
      { status: 403 },
    );
  }

  try {
    await saveQuizAnswers(live.quiz_version, parsed.answers);
  } catch (error) {
    if (error instanceof SessionUnavailable) {
      return Response.json(
        { error: "Your session expired. Start again." },
        { status: 401 },
      );
    }
    console.error("quiz save failed", (error as Error).message);
    return Response.json(
      {
        error: presentableFailure(
          error,
          "We couldn't save your answers. Please try again.",
        ),
      },
      { status: 502 },
    );
  }

  /* No score in the response on purpose: the result screen reads it back off the
     record through `loadScore`, so there is one definition of "this browser's score"
     and a stale copy can't be handed forward from here. */
  return Response.json({ ok: true });
}
