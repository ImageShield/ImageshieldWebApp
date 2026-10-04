/**
 * The person record behind a lead.
 *
 * Names and email are SEPARATE writes on /v1, and conflating them is a 400. The old
 * funnel posted one `/update-profile` body carrying `phone`, `firstName`, `lastName`,
 * `email` and `fullName` together; `PATCH /v1/me/profile` takes first_name, last_name,
 * date_of_birth, employer_name, occupation and school_name, rejects anything else,
 * and takes no phone at all because the session already says who this is.
 *
 * Email has its own route because setting one SENDS A VERIFICATION EMAIL and leaves
 * the address unverified until the link is opened. That is a real behaviour change
 * for the funnel: every lead who verifies their phone now also receives a mail. It is
 * also why `saveLead` only calls it when the address actually differs from what is on
 * record — re-sending on every save would mail a fresh link to a returning visitor
 * who changed nothing.
 */
import "server-only";

import { callAsUser } from "../session";
import type { Me } from "./me";

export type ProfileFields = {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  employer_name?: string | null;
  occupation?: string | null;
  school_name?: string | null;
};

/**
 * The `date_of_birth` the funnel writes — a placeholder, NOT the visitor's birth date.
 *
 * Exists only for backend compatibility. The funnel stopped asking for a date of
 * birth on purpose: visitors now tick "I confirm that I am 18 years old or older"
 * instead, and no real birth date is collected, inferred or stored anywhere on this
 * side. The backend still expects a full `date_of_birth` and that contract can't
 * change yet, so on the backend team's guidance this fixed date stands in for
 * "confirmed adult". Fixed — never computed from today or from the quiz's age answer
 * — so it says nothing about the visitor beyond that confirmation.
 *
 * Handle with care, because on /v1 the field is WRITE-ONCE: the API refuses a second
 * value, so whatever lands first is permanent and only the backend can change it. The
 * value also decides who signs the person's biometric consent, and the mobile app
 * shows a recorded date read-only as the person's own. Hence `saveLead` sends this
 * only after the visitor confirmed 18+ AND `/v1/me` showed no date on the record —
 * never on a guess. Never shown in the web UI.
 */
export const SYNTHETIC_ADULT_DOB = "2005-01-01";

/**
 * Only the keys actually present are sent: the API builds the update from the keys it
 * receives, so including a field as `undefined` would blank it rather than leave it
 * alone — and unknown keys are rejected outright rather than ignored.
 */
export const patchProfile = (fields: ProfileFields) =>
  callAsUser<Me["person"]>("PATCH", "/v1/me/profile", { body: fields });

/** 202 Accepted. Records the address and sends the verification link. */
export const setEmail = (email: string) =>
  callAsUser<void>("POST", "/v1/me/email", { body: { email } });
