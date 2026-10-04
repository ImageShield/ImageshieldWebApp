import {
  deletedAccountMessage,
  deletedAccountResponse,
} from "@/lib/deleted-account";
import { validateContact } from "@/lib/contact";
import { allowOtpSend } from "@/lib/rate-limit";
import { startChallenge } from "@/lib/session";
import { requestOtp, resendCooldownSeconds } from "@/lib/v1/auth";
import { ApiFailure, presentableFailure } from "@/lib/v1/errors";

/**
 * POST /api/otp/start — { firstName, lastName, email, phone, ageConfirmed }
 *
 * `ageConfirmed` must be literally `true` — the 18+ checkbox. No date of birth is
 * taken here any more, and one sent anyway is dropped by `validateContact` before it
 * reaches the cookie.
 *
 * Sends the code and remembers the details, plus the id of the challenge the API
 * issued, in a signed cookie. Nothing is written to the person record here: an
 * unverified phone number is just a claim, and on /v1 there is nothing to write it
 * with — the write endpoints take no identifier and there is no session yet.
 *
 * The challenge id is the important part of what goes in the cookie. Verification is
 * against the challenge, not against the phone number, so keeping it server-side is
 * what stops a visitor pairing their own code entry with a challenge that isn't
 * theirs.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = validateContact(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { contact } = parsed;

  /* This funnel's own cap, in front of the API's. Not redundant: it stops a script
     from spending the API's per-phone budget on somebody else's handset, and it
     refuses without a round trip. The API's limits are the authoritative ones and
     their 429 is relayed below. */
  const allowed = allowOtpSend(request, contact.phone);
  if (!allowed.ok) {
    return Response.json({ error: allowed.error }, { status: allowed.status });
  }

  let challenge;
  try {
    challenge = await requestOtp(contact.phone);
  } catch (error) {
    /* Ahead of the 429 branch, because a deleted number's cooldown IS a 429: it
       would otherwise be relayed as "too many codes requested", which reads as a
       passing squall over something that can last days. */
    const deleted = deletedAccountMessage(error);
    if (deleted) return deletedAccountResponse(deleted);

    if (error instanceof ApiFailure) {
      /* The API counts per-IP, per-phone and a resend cooldown, and says which with
         a `retry_after`. Relaying it beats a generic 502: the visitor is told to
         wait rather than told something broke. */
      if (error.status === 429) {
        return Response.json(
          {
            error: presentableFailure(
              error,
              "Too many codes requested. Try again in a few minutes.",
            ),
            retryAfter: error.retryAfter,
          },
          { status: 429 },
        );
      }
      /* VALIDATION_FAILED here means the number wasn't E.164 after all — the API's
         idea of that is the one that counts. Its wording is not, though: it answers
         "phone_e164: Invalid", which names a field the visitor has never seen. */
      if (error.status === 400) {
        console.error("otp/start rejected", error.code, error.message);
        return Response.json(
          { error: "Enter your number with its country code" },
          { status: 400 },
        );
      }
    }
    console.error("otp/start failed", {
      status: error instanceof ApiFailure ? error.status : undefined,
      code: error instanceof ApiFailure ? error.code : undefined,
      message: (error as Error).message,
    });
    return Response.json(
      { error: "Couldn't send your code. Please try again." },
      { status: 502 },
    );
  }

  await startChallenge(contact, challenge.challenge_id);

  return Response.json({
    ok: true,
    // The phone goes back so the OTP screen can show which number it texted, without
    // trusting the client to keep holding it.
    phone: contact.phone,
    // The API's own cooldown, so the screen's "Resend in Ns" counts the real wait
    // instead of a number this side made up. Converted from the ISO instant the
    // API actually sends — see `resendCooldownSeconds`.
    resendAfter: resendCooldownSeconds(challenge),
  });
}
