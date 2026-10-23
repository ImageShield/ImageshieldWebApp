# Quiz analytics: test plan

**For:** whoever releases or re-checks the quiz analytics.
**Covers:** the automated tests, the browser checks run on 22 October 2026, the checks still to do after release, and what to do when one fails.

## 1. Automated tests

Run from the repository root:

```
npx vitest run          # all tests
npx tsc --noEmit        # type check
npx eslint src          # lint
```

Result on 23 October 2026, including the answer-time under-18 stop: **31 test files, 393 tests passed**; type check and lint clean. The suite also passes, unchanged, with `ANSWER_ANALYTICS_APPROVED` set to `true` (run with the constant edited and then restored), so the approval change needs no test edits.

No failures existed before this work, and none were introduced.

| Requirement | Test file | Tests |
|---|---|---|
| Each event's fields, and nothing else | `src/lib/analytics.test.ts` | "payloads": start, answer, complete; "never forwards a field outside the schema" (email, phone, code, score, band, name) |
| Unknown event names, bad question ids, out-of-range numbers, bad versions dropped | `analytics.test.ts` | "drops …" cases |
| Fields reset so values can't carry over in GTM | `analytics.test.ts` | "clears every field an event doesn't carry" |
| Consent: not chosen, rejected, granted before GTM loads, granted mid-quiz, withdrawn | `analytics.test.ts` | "consent" block |
| Start before the first answer after a mid-question grant | `analytics.test.ts` | "sends the start before the first answer after a mid-question grant" |
| Duplicates, order, reload, new quiz version | `analytics.test.ts` | "duplicates and order" block |
| Under-18 | `analytics.test.ts`, `analytics.approved.test.ts`, `QuizFlow.test.tsx` | "under-18s"; "still sends nothing at all once the age answer is under 18"; "sends nothing for an under-18 finisher" |
| Every v11 question by reviewed id; no answers while unapproved | `analytics.test.ts` | "reports every v11 question by its reviewed id" |
| Unknown version keeps the shape, uses backend keys, no answers | `analytics.test.ts`, `analytics.approved.test.ts` | "reports an unknown version's questions by their backend keys"; "sends no answer for an unreviewed quiz version" |
| Gated questions never reported | `analytics.test.ts` | "question numbers" block |
| Approved answers for v11 and v17; never age, gender or misuse | `src/lib/analytics.approved.test.ts` | "v11 (prod)…", "v17 (dev)…" |
| Multi-select: deterministic order, within 100 characters, defined options only | `analytics.approved.test.ts` | "encodes every platform…", "sends only options the definition offers" |
| Question changed in place gets no answer | `analytics.approved.test.ts` | "…whose question has changed in place" |
| Direct calls can't attach a sensitive or invalid answer | `analytics.approved.test.ts` | "strips a direct … answer" (gender, misuse, age, unknown option, duplicate, too long, two values on a single question) |
| `quiz_start` once, at the first question shown; answer; completion | `src/components/quiz/QuizFlow.test.tsx` | "starts on the first question shown…", "starts once, on the first question…" |
| Multi-select sends once, on Continue | `QuizFlow.test.tsx` | "pushes a multi-select once, on Continue, not on each tick" |
| Revisits and reloads counted once | `QuizFlow.test.tsx` | "counts a revisited question, and a reloaded screen, once" |
| Quiz unchanged with analytics rejected or withdrawn | `QuizFlow.test.tsx` | "runs the quiz the same with analytics rejected", "…withdrawn mid-quiz" |
| Existing quiz routing, under-18 turn-away, submission | `QuizFlow.test.tsx`, `DetailsForm.test.tsx`, `OtpForm.test.tsx`, `Calculating.test.tsx`, `ResumeSave.test.tsx`, `src/app/score/page.test.tsx` | Existing tests, all passing unchanged |
| Consent v2, re-asking everyone, new wording, once approved | `src/components/consent/ConsentBanner.approved.test.tsx` | 4 tests |
| Today's banner wording unchanged while the switch is off | `src/components/consent/ConsentBanner.test.tsx` | 2 tests |
| Consent behaviour unchanged while the switch is off | `ConsentManager.test.tsx`, `src/lib/consent.test.ts` | Existing tests, now written against the current version so they hold either way |
| A "no" after re-asking clears the earlier "yes"'s cookies | `ConsentManager.test.tsx` | "clears an outdated choice's cookies…", "keeps … when the visitor now accepts" |
| Age, gender and misuse answers blocked even if the map is wrong | `src/lib/analytics.denylist.test.ts` | 1 test |
| The map only forwards what the banner names; unique ids, keys, positions; no separator in options | `analytics.test.ts` | "the reviewed question map" |
| Reset push after every event | `analytics.test.ts` | "clears every field again straight after each event" |
| Fails closed when the age question can't recognise minors | `analytics.test.ts` | "sends nothing at all when …" |
| No completion while a question is unanswered | `analytics.test.ts` | "sends no completion while any question is unanswered" |
| Analytics can't throw into the quiz | `analytics.test.ts` | "never throws into the quiz…" |
| Reworded or moved question gets no answer | `analytics.approved.test.ts` | "sends no answer for a question reworded in place", "…moved to another position" |
| On-screen quiz with approval: multi-select order on Continue; single answer; no gender answer | `src/components/quiz/QuizFlow.approved.test.tsx` | 2 tests |
| Under-18 redirects are full page loads, keeping push/replace, consent denied first | `src/lib/not-eligible.test.ts`; redirect tests in `QuizFlow`, `DetailsForm`, `OtpForm` (including an age that changes after the screen loads), `Calculating`, `ResumeSave` | |
| No GTM or HubSpot on `/not-eligible` or for an under-18 tab, whatever the consent; adults unaffected | `ConsentManager.test.tsx` | "ConsentManager for under-18 visitors" block |
| Back/forward-cache restore reloads a blocked page still running trackers | `not-eligible.test.ts`, `ConsentManager.test.tsx` | "reloadIfTrackingSurvived", "reloads a page restored from the back/forward cache…" |

**Not covered, because the code doesn't exist:** partial-session ingestion, the backend's retention and deletion, rate limiting of ingestion, and linking anonymous and verified sessions. See section 4.

## 2. Browser checks run on 22 October 2026

**Setup:** a copy of the app run locally against the offline API fixture (`node tools/dev-offline.mjs`, quiz `likeness-health-v17`, test code `123456`), driven by headless Chrome. The **real** `GTM-NM7B8G3X` container was loaded. It has no tags, so nothing was sent to GA4. Test data only.

| Scenario | Expected | Result |
|---|---|---|
| Accept, complete the quiz (two platforms ticked) | `quiz_start` 1, six `quiz_answer` (age, gender, platforms, prior_misuse, posting_volume, monitoring_method), `quiz_complete` 6; every event processed by GTM; no answers | Pass |
| Accept, leave after 3 questions | `quiz_start`, three `quiz_answer`, no `quiz_complete` | Pass |
| Accept on question 3 | Nothing before; `quiz_start` 3 then answers 3–6 and completion | **Failed first:** the answer for question 3 arrived before the start. Fixed (start is sent before the first answer) and re-run: Pass |
| Reject all | No `dataLayer`, no Google requests; quiz completes to the score | Pass |
| Withdraw after 2 answers | Events before; after the reload, no `dataLayer` and no GTM request | Pass |
| Answer "Under 18" | Only `quiz_start`; sent to the not-eligible page | Pass |
| Switch flipped on, in the test copy only, consent `v2` | Answers only on platforms (`X (Twitter)\|Snapchat`), posting_volume, monitoring_method; none on age, gender, prior_misuse | Pass |
| GTM data model after `prior_misuse` follows `platforms` | `answer` reads as unset | Pass |
| After the review fixes (23 Oct): all scenarios above re-run | Same results; with the switch on, GTM's `answer` reads as unset straight after every answer event | Pass |
| Reload of the score page | No new events | Pass |

### Under-18 safeguard, browser checks (23 October 2026, everything accepted)

Re-run for the release review on a production build made the way Amplify builds it: Node 22, `npm install`, `npm run build`, served by `next start` against the offline API behind a local HTTPS proxy.

Each check confirms which document actually loaded (the browser's navigation record), so a client-side hop can't pass for a full page load.

| Scenario | Result |
|---|---|
| Answer "Under 18", finish the quiz | Consent denied once, at the age answer; the remaining questions are still asked. Then a new page at `/not-eligible`: no GTM, no HubSpot, no `dataLayer`. No Google or HubSpot requests after the answer |
| Refresh `/not-eligible`; Back button; "Back to home" | Nothing loads on any of them |
| Open `/not-eligible` directly, with and without accepting there | Nothing loads |
| Open `/details` with an under-18 answer stored | New page at `/not-eligible`, nothing loads |
| Back through the quiz, change the age to under 18, reopen `/otp` | New page at `/not-eligible`; the code is never verified |
| `Calculating`: the server refuses (answers rewritten to under 18 in transit) | Page with GTM running → new page at `/not-eligible`, nothing loads |
| `ResumeSave`: first save fails, then `/score` retries and the server refuses | Same |
| Adult run | Unchanged: GTM loads, eight quiz events |

**Not testable locally:**
- **Back/forward-cache restores.** Headless Chrome reloaded the page instead of restoring it, and quiz pages are `no-store`. The reload guard is unit-tested.
- **A Google tag's final ping on unload.** The container has no tags.

Both are in the production checks below.

## 3. After release: production checks

Run these once the quiz update is live, before relying on any report.

1. Live `/quiz` with no consent cookie: no GTM request.
2. The UK team's Preview checklist (`GTM_GA4_HANDOFF.md`, section 8), steps 1–9.
3. GA4 DebugView shows `quiz_start`, `quiz_answer`, `quiz_complete` with the right parameters.
4. Next day: GA4 Realtime or standard reports show the events, with `quiz_version` = `likeness-health-v11`.
5. If answer collection has been approved and switched on: the banner asks everyone again (consent `v2`), and `answer` appears only on the three approved questions.
6. **Under-18, in Chrome and in Safari:** handoff section 8, step 8. Expect:
   - the page reloads at `/not-eligible` with GTM absent (`window.google_tag_manager` undefined in the console);
   - nothing loads after Back, refresh or "Back to home";
   - no `collect` request carrying `not-eligible`.

   In Safari, press Back from `/not-eligible` and check in the console that `window.google_tag_manager` is undefined on the restored quiz page.

**Until step 3 passes, GA4 delivery is unproven.** A successful push to the `dataLayer` doesn't show that GA4 received anything.

## 4. Partial sessions: tests needed when built

These are required before partial-answer collection can be called working. All are blocked on the backend work in `QUIZ_ANALYTICS_IMPLEMENTATION.md`, section 7.

| Test | Expected |
|---|---|
| Answer 3 questions, close the browser, query the backend | One session, three answers, no completion |
| Same answer retried 3 times | One row |
| Offline answer, then reconnect | Row written on reconnect |
| Invalid version, unknown key, undefined option, two values on a single-answer question, 5 KB body | Rejected with 400; nothing stored |
| Session id never issued, or without its token | Rejected |
| Under-18 age answer | Session deleted; later writes rejected |
| Consent withdrawn | Session deleted |
| Past retention | Deleted by the daily job |
| Rate limit | Excess session creation rejected |
| Backend logs | No answer values |

## 5. When a check fails

| Failure | Action |
|---|---|
| Any answer value for age, gender or prior misuse appears anywhere | Treat as a privacy incident: set the switch off, remove the tags' `answer` parameter, tell the privacy owner |
| Events without consent | Same as above |
| Duplicates or wrong order | Capture the `dataLayer` (`copy(dataLayer)` in the browser console on a test visit) and the steps; fix in `src/lib/analytics.ts` with a regression test |
| GA4 missing events that Preview shows | GA4 configuration: check the measurement ID, the hostname conditions and the property's data filters |
