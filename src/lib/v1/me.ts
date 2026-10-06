/**
 * `GET /v1/me` — the one read that answers what the old backend needed four calls
 * for (`/check-user`, `/getUserProfile`, `/users/{phone}`, `/check-email-verification`).
 *
 * It takes no identifier: the person IS the session. Nothing here accepts a phone,
 * which is why the funnel no longer carries one past the OTP screen.
 *
 * Empty is not an error. A brand-new account gets 200 with nulls — `household` and
 * `score` are null before a plan and before the quiz — so there is nothing here to
 * special-case the way the legacy 404s forced.
 */
import "server-only";

import type { DisplayedScore, QuizFactor } from "../score";
import { readAsUser, callAsUser } from "../session";
import type { Onboarding } from "./auth";

export type Me = {
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
  /**
   * The score stored on the account. Null before the quiz.
   *
   * The funnel normally reads the full record from `/v1/me/score` instead. This is
   * the fallback for an account that endpoint answers QUIZ_OUTDATED for — see
   * `storedScoreOf`.
   *
   * The number arrives as `live`, which is what the API actually serves (the app
   * verified it against the live API); `total_score` is the name the collection
   * documents, kept as a fallback the way the app keeps it.
   */
  score: {
    live?: number;
    total_score?: number;
    band: string;
    computed_at: string;
    breakdown?: { quiz?: QuizFactor[] };
  } | null;
};

/** For a server component's render. Throws `SessionUnavailable` rather than refreshing. */
export const readMe = () => readAsUser<Me>("GET", "/v1/me");

/** For a route handler, which may refresh and persist the rotated pair. */
export const fetchMe = () => callAsUser<Me>("GET", "/v1/me");

/**
 * The score already on this account, or null when it has none.
 *
 * What an account whose quiz was answered against a retired version is shown, rather
 * than a score recomputed from the web quiz: `/v1/me/score` has no record for it,
 * but the account still carries the number it had — the same number the app's Home
 * screen falls back to. No breakdown is guaranteed here, so the result screen leaves
 * out its risk-factor card when there are none.
 */
export function storedScoreOf(me: Me): DisplayedScore | null {
  const stored = me.score;
  const live = stored?.live ?? stored?.total_score;
  if (!stored || typeof live !== "number" || !Number.isFinite(live)) return null;
  return {
    live,
    band: stored.band,
    breakdown: { quiz: stored.breakdown?.quiz ?? [] },
  };
}

/** The display name for the result screen. Falls back rather than rendering "null". */
export function firstNameOf(me: Me): string {
  return me.person.first_name?.trim() || "there";
}
