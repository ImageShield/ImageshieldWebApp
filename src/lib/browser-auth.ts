"use client";

/**
 * Browser-side OTP authentication and lead saving, replacing the server-side
 * route handlers that used to proxy these calls.
 */

import { call, callAsUser, ApiFailure, presentableFailure } from "./api-client";
import { adoptTokens, type TokenPair } from "./browser-session";
import type { Contact } from "./contact";

export type OtpChallenge = {
  challenge_id: string;
  expires_at: string;
  resend_after: string;
};

type Onboarding = {
  next_step: string | null;
  blocking_coverage?: string[];
  profile_complete?: boolean;
  quiz_completed?: boolean;
  seat_claimed?: boolean;
  consent_signed?: boolean;
  enrolled?: boolean;
  email_verified?: boolean;
  photos_uploaded?: boolean;
  notifications_enabled?: boolean;
  skipped_steps?: string[];
};

type Me = {
  account: { phone_e164: string; status: string };
  person: {
    person_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    email_verified: boolean;
    date_of_birth: string | null;
    employer_name: string | null;
    occupation: string | null;
    school_name: string | null;
  };
  onboarding: Onboarding;
  score: {
    live?: number;
    total_score?: number;
    band: string;
    computed_at: string;
  } | null;
};

/** The placeholder birth date the backend requires. See profile.ts for context. */
const SYNTHETIC_ADULT_DOB = "2005-01-01";

/** Converts `resend_after` ISO timestamp to seconds. */
export function resendCooldownSeconds(challenge: OtpChallenge): number | null {
  const at = Date.parse(challenge.resend_after);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

/** Whether this failure is about a deleted account's phone cooldown. */
function deletedAccountMessage(cause: unknown): string | null {
  if (!(cause instanceof ApiFailure)) return null;
  if (cause.code === "PHONE_COOLDOWN") {
    return `This number belonged to a recently deleted account. It can open a new one shortly.`;
  }
  if (cause.code === "ACCOUNT_DELETING") {
    return "This account is being deleted. Once deletion finishes and its waiting period passes, the number can start a new account.";
  }
  return null;
}

/** The stored score on the Me object, if any. */
function storedScoreOf(me: Me): boolean {
  const stored = me.score;
  const live = stored?.live ?? stored?.total_score;
  return stored !== null && typeof live === "number" && Number.isFinite(live);
}

/* ── OTP start ─────────────────────────────────────────────────────────────── */

export type OtpStartResult =
  | { ok: true; phone: string; challengeId: string; resendAfter: number | null }
  | { ok: false; error: string; status: number; blocked?: boolean };

export async function startOtp(contact: Contact): Promise<OtpStartResult> {
  let challenge: OtpChallenge;
  try {
    challenge = await call<OtpChallenge>("POST", "/v1/auth/otp", {
      body: { phone_e164: contact.phone },
    });
  } catch (error) {
    const deleted = deletedAccountMessage(error);
    if (deleted) return { ok: false, error: deleted, status: 409, blocked: true };

    if (error instanceof ApiFailure) {
      if (error.status === 429) {
        return {
          ok: false,
          error: presentableFailure(
            error,
            "Too many codes requested. Try again in a few minutes.",
          ),
          status: 429,
        };
      }
      if (error.status === 400) {
        return {
          ok: false,
          error: "Enter your number with its country code",
          status: 400,
        };
      }
    }
    return {
      ok: false,
      error: "Couldn't send your code. Please try again.",
      status: 502,
    };
  }

  return {
    ok: true,
    phone: contact.phone,
    challengeId: challenge.challenge_id,
    resendAfter: resendCooldownSeconds(challenge),
  };
}

/* ── OTP verify ────────────────────────────────────────────────────────────── */

export type OtpVerifyResult =
  | { ok: true; quizAlreadyTaken: boolean }
  | { ok: false; error: string; status: number; blocked?: boolean };

export async function verifyOtp(
  challengeId: string,
  code: string,
  contact: { firstName: string; lastName: string; email: string; ageConfirmed: boolean },
): Promise<OtpVerifyResult> {
  // Verify the OTP
  let pair: TokenPair & { onboarding?: Onboarding };
  try {
    pair = await call<TokenPair & { onboarding?: Onboarding }>(
      "POST",
      "/v1/auth/otp/verify",
      { body: { challenge_id: challengeId, code } },
    );
  } catch (error) {
    const deleted = deletedAccountMessage(error);
    if (deleted) return { ok: false, error: deleted, status: 409, blocked: true };

    if (error instanceof ApiFailure) {
      if (error.status === 404) {
        return {
          ok: false,
          error: "That code has expired. Tap Resend for a new one.",
          status: 400,
        };
      }
      if (error.status === 401 || error.status === 400) {
        return { ok: false, error: "That code isn't right", status: 400 };
      }
    }
    return {
      ok: false,
      error: "Couldn't check your code. Please try again.",
      status: 502,
    };
  }

  // Store the tokens
  adoptTokens(pair);

  // Read the account to decide routing and to save lead data
  let me: Me | null = null;
  try {
    me = await callAsUser<Me>("GET", "/v1/me");
  } catch {
    // Non-fatal - lead save below will skip what it can't check.
  }

  // Save lead data (name, email, DOB placeholder)
  await saveLead(contact, me);

  return {
    ok: true,
    quizAlreadyTaken:
      me !== null &&
      (me.onboarding.quiz_completed === true || storedScoreOf(me)),
  };
}

/* ── OTP resend ────────────────────────────────────────────────────────────── */

export type OtpResendResult =
  | { ok: true; challengeId: string; resendAfter: number | null }
  | { ok: false; error: string; status: number; blocked?: boolean };

export async function resendOtp(phone: string): Promise<OtpResendResult> {
  let challenge: OtpChallenge;
  try {
    challenge = await call<OtpChallenge>("POST", "/v1/auth/otp", {
      body: { phone_e164: phone },
    });
  } catch (error) {
    const deleted = deletedAccountMessage(error);
    if (deleted) return { ok: false, error: deleted, status: 409, blocked: true };

    if (error instanceof ApiFailure && error.status === 429) {
      return {
        ok: false,
        error: presentableFailure(
          error,
          "Too many codes requested. Try again in a few minutes.",
        ),
        status: 429,
      };
    }
    return {
      ok: false,
      error: "Couldn't send your code. Please try again.",
      status: 502,
    };
  }

  return {
    ok: true,
    challengeId: challenge.challenge_id,
    resendAfter: resendCooldownSeconds(challenge),
  };
}

/* ── Lead save ─────────────────────────────────────────────────────────────── */

async function saveLead(
  contact: { firstName: string; lastName: string; email: string; ageConfirmed: boolean },
  me: Me | null,
): Promise<boolean> {
  const dobKnownMissing = me?.person ? !me.person.date_of_birth : false;
  const needsDob = contact.ageConfirmed && dobKnownMissing;

  try {
    await callAsUser<unknown>("PATCH", "/v1/me/profile", {
      body: {
        first_name: contact.firstName,
        last_name: contact.lastName,
        ...(needsDob ? { date_of_birth: SYNTHETIC_ADULT_DOB } : {}),
      },
    });

    const wanted = contact.email.trim();
    const onRecord = me?.person.email?.trim() ?? "";
    if (wanted !== "" && wanted.toLowerCase() !== onRecord.toLowerCase()) {
      await callAsUser<void>("POST", "/v1/me/email", {
        body: { email: wanted },
      });
    }

    return true;
  } catch {
    return false;
  }
}
