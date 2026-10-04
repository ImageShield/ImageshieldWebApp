import {
  deletedAccountMessage,
  deletedAccountResponse,
} from "@/lib/deleted-account";
import { adoptTokens, clearChallenge, readChallenge } from "@/lib/session";
import { saveLead } from "@/lib/quiz-save";
import { allow } from "@/lib/rate-limit";
import { verifyOtp } from "@/lib/v1/auth";
import { ApiFailure } from "@/lib/v1/errors";
import { fetchMe, type Me } from "@/lib/v1/me";

/**
 * POST /api/otp/verify — { code }
 *
 * Exchanges the code for a session and banks the lead's name and email against it.
 * What identifies the record is the session, not anything in this body — on /v1 no
 * route takes a phone, a person id or an account id to decide whose data it touches.
 *
 *   /v1/auth/otp/verify  the code for an access and refresh token. The challenge is
 *                        spent whatever happens next.
 *   /v1/me               who we now are. Read before the write because the email
 *                        below is only sent when it differs from what is on record.
 *   /v1/me/profile       the lead's name, and the placeholder birth date the API
 *                        requires — see `saveLead`.
 *   /v1/me/email         the lead's email — and a verification mail with it.
 *
 * The quiz is deliberately NOT here, though the answers do exist by this point — the
 * questions are asked two screens back and are sitting in the visitor's tab. This
 * route once scored them as part of verifying, so that there was no window in which a
 * half-authenticated visitor could write. The cost was worse than the window: a /v1
 * challenge is spent the moment it is accepted, so a score write that failed here left
 * someone holding a dead code with nothing to retype. Splitting them means the session
 * this route mints is what the write runs on, and `/api/quiz` can be retried all day.
 * That is what the old `verified: true` response existed to rescue.
 *
 * On statuses, because one of them changed with the API: a wrong code is a 401 from
 * /v1 and is answered here as a **400**, because this route reserves 401 for "there
 * is no pending challenge in this browser" — the one condition where retyping and
 * resending are both pointless and the screen has to offer a fresh number instead.
 * Collapsing the two would send someone who mistyped a digit back to the start.
 */
export async function POST(request: Request) {
  const challenge = await readChallenge();
  if (!challenge) {
    return Response.json(
      { error: "Your code expired. Request a new one." },
      { status: 401 },
    );
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  /* Exactly six. The API validates the length and would answer a five-digit entry
     with the same 401 it gives a wrong code, which reads as "that code isn't right"
     for something that was never a code. */
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return Response.json(
      { error: "Enter the 6-digit code we texted you" },
      { status: 400 },
    );
  }

  // Six digits is 1e6 guesses; the API caps attempts per challenge, and this caps
  // them per number so a script can't buy fresh attempts by resending.
  if (!allow(`verify:${challenge.phone}`, 6, 10 * 60 * 1000)) {
    return Response.json(
      { error: "Too many wrong codes. Request a new one." },
      { status: 429 },
    );
  }

  try {
    const pair = await verifyOtp(challenge.challengeId, code);
    await adoptTokens(pair);
  } catch (error) {
    /* The code was accepted and the account behind the number is gone or going.
       Ahead of the 400/401 branch below, which would call a correct code wrong. */
    const deleted = deletedAccountMessage(error);
    if (deleted) return deletedAccountResponse(deleted);

    if (error instanceof ApiFailure) {
      /* 404 NOT_FOUND, not the 401 the collection documents — verified against the
         live API. It means the challenge is gone: expired, or burned by too many
         attempts. Retyping cannot help, but Resend can (it re-issues against the
         phone in the cookie, not against this dead id), so the screen keeps its
         resend button and this says which button to press. */
      if (error.status === 404) {
        return Response.json(
          { error: "That code has expired. Tap Resend for a new one." },
          { status: 400 },
        );
      }

      /* Our own copy rather than the API's. These messages ("invalid credentials",
         "phone_e164: Invalid") are written for whoever is reading a log, not for
         someone holding a phone. */
      if (error.status === 401 || error.status === 400) {
        console.error("otp/verify rejected", error.status, error.code, error.message);
        return Response.json({ error: "That code isn't right" }, { status: 400 });
      }
    }
    console.error("otp/verify failed", {
      status: error instanceof ApiFailure ? error.status : undefined,
      code: error instanceof ApiFailure ? error.code : undefined,
      message: (error as Error).message,
    });
    return Response.json(
      { error: "Couldn't check your code. Please try again." },
      { status: 502 },
    );
  }

  /* The code is spent and the session exists, so the challenge cookie has done its
     job. The name and email are read out of it just below, before it goes. */
  const contact = {
    firstName: challenge.firstName,
    lastName: challenge.lastName,
    email: challenge.email,
    /* Always true by now — `readChallenge` refuses an unconfirmed cookie outright.
       Compared rather than copied anyway, because this flag is what lets `saveLead`
       write a placeholder birth date to a write-once field, and that should not
       hinge on a check in another file staying put. */
    ageConfirmed: challenge.ageConfirmed === true,
  };
  await clearChallenge();

  /* Read before the write, and never fatal: it decides whether the email call sends
     a fresh verification mail, and a blip here must not cost the visitor their run. */
  let me: Me | null = null;
  try {
    me = await fetchMe();
  } catch (error) {
    console.error("me read failed", (error as Error).message);
  }

  /* Never fatal either. The visitor is on their way to the score; a name that didn't
     save is worth a log, not a dead end — and `/api/quiz` will not care. */
  const leadSaved = await saveLead(contact, me);

  return Response.json({
    ok: true,
    leadSaved,
    /* Whether this number had already got somewhere in the app before the funnel
       touched it. The server's own onboarding block answers it now, rather than this
       side inferring it from flags it had just written itself. */
    returningAppUser: Boolean(
      me?.onboarding.enrolled || me?.onboarding.photos_uploaded,
    ),
    /* Already answered the quiz on another device or in the app. The OTP screen does
       not branch on it yet; it is here so "take the quiz" can become "see your score"
       without another round trip. */
    quizAlreadyTaken: Boolean(me?.onboarding.quiz_completed),
  });
}
