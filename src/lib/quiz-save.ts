import "server-only";

import type { QuizAnswers } from "./quiz";
import type { ScoreEnvelope } from "./score";
import type { Me } from "./v1/me";
import { patchProfile, setEmail, SYNTHETIC_ADULT_DOB } from "./v1/profile";
import { submitQuizResponses } from "./v1/quiz";

/**
 * The funnel's two writes onto the person record — the score, and the lead behind it.
 *
 * They live here rather than inside `/api/otp/verify` because the verify request is
 * no longer the only place they happen. A /v1 challenge is spent the moment it is
 * accepted and its attempts are capped, so a code is good exactly once: if a write
 * after it fails, re-sending the same six digits cannot possibly work. `/api/quiz`
 * retries the write against the already-authenticated session instead, and both
 * routes go through these two functions so there is one definition of what the
 * funnel puts on the record.
 */

/**
 * Scores the answers onto the person record.
 *
 * Throws on failure — what that costs the visitor is the caller's call, and it
 * differs: mid-verify it is a 502 the client can retry, in `/api/quiz` it is the
 * whole request.
 */
export async function saveQuizAnswers(
  quizVersion: string,
  answers: QuizAnswers,
): Promise<ScoreEnvelope> {
  return submitQuizResponses(quizVersion, answers);
}

/**
 * The lead's name and email, onto the same record — plus the placeholder birth date
 * the API still requires, when the visitor confirmed they are 18 or older.
 *
 * Never fatal, and deliberately attempted BEFORE the score: the score can be retried
 * from the client afterwards, but the name and email only exist in the pre-verification
 * cookie for as long as that cookie does. Saving them first means a blip on the quiz
 * write costs the lead nothing.
 *
 * Two calls rather than one, because /v1 splits them and rejects a body that mixes
 * them. The profile patch goes first: if the email call then fails, the name is
 * already saved and the retry is the email alone.
 *
 * The email is only sent when it differs from what is on record, and that is not a
 * micro-optimisation — `POST /v1/me/email` SENDS A VERIFICATION MAIL every time it
 * is called. A returning visitor who re-runs the funnel with the same address would
 * otherwise be mailed a fresh link for no reason.
 *
 * Worth stating plainly, because it is new: on the legacy backend the funnel's
 * `/update-profile` also set `profileCompleted`, which the app read as "onboarding
 * finished" and used to skip the selfie step. /v1 keeps its own `onboarding` block
 * and this write only fills in a name — so a web lead who installs the app now lands
 * on whatever step the server says is next, which is what should have happened all
 * along.
 *
 * Returns whether it landed, which the verify response passes back for whoever is
 * counting leads.
 */
export async function saveLead(
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    ageConfirmed: boolean;
  },
  me: Me | null,
): Promise<boolean> {
  /* Never the visitor's birth date — the funnel doesn't collect one. The placeholder
     is what the API's required field gets in its place, and only when both hold:

       - the visitor ticked the 18+ box.
       - `/v1/me` was read and shows no birth date on the record.

     The second is strict because `date_of_birth` is WRITE-ONCE: the API refuses a
     second value, and that refusal fails the whole PATCH — the name goes with it,
     and the email call after it never runs. So a date already on record is left
     alone (the key is omitted, and the PATCH only touches the keys it is sent), and
     a failed read (`me` null) sends no date at all rather than guess. A record left
     without one can still be given one later; a record sent a second one loses the
     whole lead save. */
  const dobKnownMissing = me?.person ? !me.person.date_of_birth : false;
  const needsDob = contact.ageConfirmed && dobKnownMissing;

  try {
    /* Only the keys we mean to change. The API builds the update from the keys it
       receives, so sending a field as undefined would blank it — and `employer_name`,
       `occupation` and `school_name` are things an existing app user may well have
       filled in. The legacy funnel spread them in as undefined on every save; this
       does not, which quietly fixes a way the web could wipe an app user's details. */
    await patchProfile({
      /* Collected as two fields, which is what `PATCH /v1/me/profile` stores. The
         form used to ask for one "Full Name" and this split it on the first space —
         wrong for anyone whose given name is two words, and lossy besides, since /v1
         has no field to keep the original string in. Asking for the two parts the
         record actually has removes the guess entirely. */
      first_name: contact.firstName,
      last_name: contact.lastName,
      ...(needsDob ? { date_of_birth: SYNTHETIC_ADULT_DOB } : {}),
    });

    const wanted = contact.email.trim();
    const onRecord = me?.person.email?.trim() ?? "";
    if (wanted !== "" && wanted.toLowerCase() !== onRecord.toLowerCase()) {
      await setEmail(wanted);
    }

    return true;
  } catch (error) {
    // No phone in this log line: /v1 has no phone-keyed anything, and the session
    // this ran under is what identifies the record — not something to print.
    console.error("lead save failed", (error as Error).message);
    return false;
  }
}
