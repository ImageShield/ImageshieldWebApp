/**
 * Name / email / phone / 18+ confirmation rules, shared by the form and the route
 * handlers so the client can't submit something the server would then have to guess
 * about.
 *
 * Client-safe: no secrets, no server-only import.
 */

/**
 * E.164, the format the app's login sends (`+${callingCode}${digits}`) and the
 * format Twilio needs. The backend keys the user record on this string, so a
 * missing country code doesn't just fail to send an SMS — it forks a second
 * record that the app will never find.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Deliberately loose: rejecting valid-but-unusual addresses costs more leads
 *  than accepting a typo, and nothing here depends on the mail arriving. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /**
   * The visitor ticked "I confirm that I am 18 years old or older". Always `true` on a
   * validated contact — there is no such thing as a contact without it.
   *
   * This replaced a date-of-birth field, and the funnel no longer asks for, accepts or
   * keeps a birth date in any form. `PATCH /v1/me/profile` still wants one, so a fixed
   * placeholder is written there instead — see `SYNTHETIC_ADULT_DOB`.
   */
  ageConfirmed: true;
};

/**
 * Strips separators and settles on a leading `+` — but never invents one. A bare
 * "5551230000" is not a number we can key a user record on: prefixing `+` would
 * turn it into the perfectly valid Colombian-looking +5551230000 and quietly write
 * the score to a record nobody owns. The form supplies the country code (a picker,
 * as in the app's LoginScreen) or the submission is rejected.
 */
export function normalizePhone(raw: string): string {
  // Users paste spaces, dashes and brackets from their contacts app.
  const cleaned = raw.replace(/[^\d+]/g, "");
  // 00 is how most of the world writes the international prefix by hand.
  return cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;
}

/** Both name parts are stored as typed, so the only shaping is a trim and a cap.
 *  80 each matches what the legacy `fullName` field allowed for the pair. */
const MAX_NAME_LENGTH = 80;

export function validateContact(
  raw: unknown,
): { ok: true; contact: Contact } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "missing body" };
  }
  /* Anything else in the body is ignored, and that includes a `dob` from a client
     built before the date field was removed: the contact below is assembled field by
     field, so a birth date that arrives here goes no further than this line. */
  const { firstName, lastName, email, phone, ageConfirmed } = raw as Record<
    string,
    unknown
  >;

  if (typeof firstName !== "string" || firstName.trim() === "") {
    return { ok: false, error: "Enter your first name" };
  }
  /* A surname is asked for but not insisted on: mononymous people exist, the API
     takes `last_name` as a nullable column, and rejecting them at the one gate in
     front of the score would be a strange place to draw that line. */
  if (typeof lastName !== "string") {
    return { ok: false, error: "Enter your last name" };
  }
  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return { ok: false, error: "Enter a valid email address" };
  }
  if (typeof phone !== "string") {
    return { ok: false, error: "Enter your phone number" };
  }

  const normalized = normalizePhone(phone);
  if (!E164.test(normalized)) {
    return { ok: false, error: "Enter your number with its country code" };
  }

  /* Strictly `true`, not truthy: a string "false" is truthy, and this flag is the
     only thing standing behind the placeholder birth date written to the record. The
     form keeps its button dimmed until the box is ticked, so a visitor only meets
     this message if something other than the form is posting.

     Last, so a visitor who got several fields wrong is told about the phone number
     first — the phone is the one the whole funnel turns on. */
  if (ageConfirmed !== true) {
    return { ok: false, error: "Confirm that you are 18 or older to continue" };
  }

  return {
    ok: true,
    contact: {
      // Trimmed here rather than at the call site: these strings are written to
      // the user record and read back into the app's UI.
      firstName: firstName.trim().slice(0, MAX_NAME_LENGTH),
      lastName: lastName.trim().slice(0, MAX_NAME_LENGTH),
      email: email.trim().toLowerCase().slice(0, 254),
      phone: normalized,
      ageConfirmed: true,
    },
  };
}
