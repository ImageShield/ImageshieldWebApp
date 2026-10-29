/**
 * Whether quiz answers may go to Google Tag Manager - the one switch legal signs off.
 *
 * Off until both of these are approved:
 *   - the consent banner's analytics wording that names answer-level collection
 *     (ANALYTICS_DETAIL_WITH_ANSWERS in components/consent/ConsentBanner.tsx), and
 *   - a quiz section in the privacy notice at imageshield.com/privacy-policy.
 *
 * Turning it on does three things together, and only together:
 *   1. bumps the consent cookie to v2 (lib/consent.ts), so everyone who chose under
 *      the old wording is asked again - a "yes" to the old wording is not a "yes" to
 *      sending answers;
 *   2. shows the new wording in the banner;
 *   3. lets the answers of questions marked `forwardAnswer` in lib/analytics-quiz-map.ts
 *      through, for visitors who accepted analytics under that wording.
 *
 * While it's off the quiz still reports progress - which question was reached, and
 * completion - which the current wording ("which screens people reach and where they
 * stop") already covers.
 */
export const ANSWER_ANALYTICS_APPROVED = false;
