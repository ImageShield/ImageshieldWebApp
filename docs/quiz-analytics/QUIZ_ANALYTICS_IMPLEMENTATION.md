# Quiz analytics: implementation

**Scope:** quiz funnel analytics for `quiz.imageshield.com`. Covers what the app emits, how each rule is enforced, and the specification for collecting partial answers from visitors who abandon before verifying.
**Status, 23 October 2026:**
- **Deployed to production on 23 October 2026,** as commit `5b28615` (Amplify job 10). The release contains `87b590d`, `2988d50`, `3aafdeb` and `5b28615`; production results are in the test plan, section 3.
- **Answer-level collection is switched off** (`ANSWER_ANALYTICS_APPROVED = false`) until legal approves it.
- **GA4 delivery is unverified.** The GTM container has no tags yet, and nothing has been confirmed in DebugView.
- **The partial-answer backend is specified but not built.** It needs the backend repository, which isn't available in this workspace.

## 1. What runs today, and what changes

| Area | Before this release (build `1bb2f76`, 16 Oct 2026) | Live since 23 Oct 2026 (`5b28615`) |
|---|---|---|
| GTM loading | Only after analytics consent (checked on the live site, 22 Oct) | Unchanged |
| GTM container `GTM-NM7B8G3X` | Published version has no tags, triggers or GA4 ID (read from the public `gtm.js`, 22 Oct) | Unchanged, re-checked 23 Oct. The UK team configures it |
| Quiz events | None | `quiz_start`, `quiz_answer`, `quiz_complete` |
| Answer values in events | None | None while `ANSWER_ANALYTICS_APPROVED` is `false`. After approval: three questions |
| Consent version | `v1` | `v1` while the switch is off; `v2` (everyone asked again) when it's on |
| Under-18 visitors | In-app hop to `/not-eligible`; any running GTM stayed loaded | Tracking stops at the answer; `/not-eligible` loads as a new page with no GTM or HubSpot (section 5) |
| Partial answers stored server-side | No. Answers stay in the tab until the code is verified | Still no; specified in section 7, not built |

## 2. Quiz versions in use

Read from `GET /v1/quiz` on 22 October 2026.

| Environment | API | Quiz version |
|---|---|---|
| Production | `prod.imageshield.com` | `likeness-health-v11` |
| Development | `dev.imageshield.com` | `likeness-health-v17` |
| Local fixture | `tools/dev-api/quiz.json` | `likeness-health-v17` |

The two versions differ in ways analytics must handle:
- The monitoring question is keyed `discovery_method` on v11 and `q_il8uju` on v17.
- `posting_volume` and `prior_misuse` swap positions 4 and 5.
- `prior_misuse` offers "Happens regularly" on v11 and "Repeated pattern" on v17.
- `posting_volume` is worded differently.

## 3. Events

All three are pushed to `window.dataLayer` by `src/lib/analytics.ts`.
- **Every push carries every schema field.** Unused ones are set to `undefined`, which is how GTM is told to forget a previous value.
- **Each event is followed by a reset push.** It has no `event` name and sets all five fields to `undefined`, so no answer lingers in GTM's memory for another tag to read (see 5.8).

| Event | Fires when | Fields with values |
|---|---|---|
| `quiz_start` | The first quiz question a visitor sees in this tab is on screen, or just before their first answer if they accepted analytics on that screen | `quiz_version`, `question_number` (where they started) |
| `quiz_answer` | An answer is **committed**: a tap on a single-answer option, or Continue on a multi-select question | `quiz_version`, `question`, `question_number`, `answer` (only when allowed, see 4) |
| `quiz_complete` | The last question is committed **and** every question has an answer (a link straight to the last question doesn't count) | `quiz_version`, `question_count` |

**Committed** means the visitor has moved past the question. Ticking and unticking boxes on a multi-select question sends nothing; Continue sends the final selection once.

**Abandonment is derived, not sent.** A visitor whose last `quiz_answer` has `question_number` N stopped at question N+1. A page-close event would miss most phones and fire on every normal exit, so there isn't one.

### Field definitions

| Field | Type | Values |
|---|---|---|
| `event` | string | `quiz_start`, `quiz_answer`, `quiz_complete` |
| `quiz_version` | string | The version the API served, e.g. `likeness-health-v11`. Never remapped |
| `question` | string | The reviewed id from section 4, or the backend key for an unreviewed version |
| `question_number` | integer 1–50 | Position among the questions everyone is asked, in this version's order |
| `question_count` | integer 1–50 | Number of questions everyone is asked in this version |
| `answer` | string, at most 100 chars | The option text exactly as the API defines it. Multi-select: options joined with `\|`, in the quiz's order |

### Examples (switch on, v11)

```js
{ event: "quiz_start",    quiz_version: "likeness-health-v11", question_number: 1,
  question: undefined, answer: undefined, question_count: undefined }
{ event: "quiz_answer",   quiz_version: "likeness-health-v11", question: "gender", question_number: 2,
  answer: undefined, question_count: undefined }
{ event: "quiz_answer",   quiz_version: "likeness-health-v11", question: "platforms", question_number: 3,
  answer: "X (Twitter)|Instagram|TikTok", question_count: undefined }
{ event: "quiz_complete", quiz_version: "likeness-health-v11", question_count: 6,
  question: undefined, question_number: undefined, answer: undefined }
```

With the switch off, as shipped, the `quiz_answer` events are identical except that `answer` is always `undefined`.

## 4. Version-specific question map

Source of truth: `src/lib/analytics-quiz-map.ts`, copied word for word from the live definitions on 22 October 2026. An answer can be reported only when the live question still matches its entry exactly: position, wording, options, and single or multi.

**`forwardAnswer`** is the proposal for which answers may go to GA4 once approved. It is **not** an approval, and nothing is forwarded while `ANSWER_ANALYTICS_APPROVED` is `false`.

### `likeness-health-v11` (production)

| # | Backend key | Reported `question` | Type | Options (canonical values) | `answer` sent once approved |
|---|---|---|---|---|---|
| 1 | `age` | `age` | single | Under 18 · 18-24 · 25-34 · 35-54 · 55+ | No |
| 2 | `gender` | `gender` | single | Female · Male · Non-Binary · Prefer not to say | No |
| 3 | `platforms` | `platforms` | multi, optional | X (Twitter) · Snapchat · Instagram · Facebook · TikTok · YouTube | Yes |
| 4 | `posting_volume` | `posting_volume` | single | Rarely (less than once a month) · Around once a month · Weekly · Daily or multiple times a day | Yes |
| 5 | `prior_misuse` | `prior_misuse` | single | No known incidents · Once or twice · Happens regularly | No |
| 6 | `discovery_method` | `monitoring_method` | single | I don’t have a way to monitor my likeness · I rely on friends and family to tell me what they've seen · I subscribe to a likeness detection/monitoring service | Yes |

Question 4 wording: "How often are photos of you shared online, either by you or by others?"

### `likeness-health-v17` (development)

| # | Backend key | Reported `question` | Type | Options | `answer` sent once approved |
|---|---|---|---|---|---|
| 1 | `age` | `age` | single | as v11 | No |
| 2 | `gender` | `gender` | single | as v11 | No |
| 3 | `platforms` | `platforms` | multi, optional | as v11 | Yes |
| 4 | `prior_misuse` | `prior_misuse` | single | No known incidents · Once or twice · Repeated pattern | No |
| 5 | `posting_volume` | `posting_volume` | single | as v11 | Yes |
| 6 | `q_il8uju` | `monitoring_method` | single | as v11 question 6 | Yes |

Question 5 wording: "How often do you post new images of yourself?"

### Why `monitoring_method`

It's the one id that isn't the backend key. The same question has two backend keys across versions, and `discovery_method` previously meant "How did you find out about the abuse?". A single neutral id gives one name in reports and keeps that older meaning out of them.

### Unknown versions and changed questions

Any version not in the map, or a mapped question whose definition has changed, is reported with its **backend key** and **no `answer`**. Nothing is ever mapped onto a reviewed version. Covering a new version means adding it to the map after review.

## 5. How each rule is enforced

All rules live in `track()` in `src/lib/analytics.ts`, so no screen repeats one.

1. **Consent.** The consent cookie is read at the moment of each push. A withdrawal stops events immediately, before the reload that removes GTM.
2. **The container's own `dataLayer`.** It only exists after `TrackingScripts` loads GTM, which only happens with analytics consent. If it's missing, events are dropped, never queued, so accepting halfway never backfills earlier steps.
3. **Under-18s.** Once the stored age answer is under 18, nothing is pushed, including that age answer.
4. **Payload built field by field.** Unknown event names and out-of-range values are dropped. Fields outside the schema can't be added, even by a caller that bypasses the types.
5. **Answer allowlist.** `answer` survives only if all of these hold:
   - the switch is on;
   - the id is not `age`, `gender` or `prior_misuse` (a rule in code, so a wrong map entry can't override it);
   - the version and id are in the map with `forwardAnswer`;
   - every value is one of that question's options, once each, in the quiz's own order;
   - the value is at most 100 characters.

   `trackAnswer` additionally requires the live question to match its map entry exactly. `track()` re-checks everything except that match, so a direct call can't attach a gender answer either.
6. **Duplicates.** Each event is sent once per tab and quiz version; answers once per question. The record of what was sent lives in `sessionStorage` under `imageshield.analytics.v1`, so it survives reloads and back/forward navigation. A changed answer to a question already reported is not re-sent: the first committed answer counts. A retake against a new quiz version counts as a new quiz.
7. **Ordering.** `trackAnswer` and `trackComplete` send `quiz_start` first if it hasn't gone yet. This was found and fixed in browser testing: a visitor who accepted analytics while on question 3 had their answer arrive before any start.
8. **Field reset.** Every push sets the unused fields to `undefined`, and every event is followed by a reset push with no event name. Without the first, GTM would report the `gender` event with the `platforms` answer pushed just before it. Without the second, that answer would stay in GTM's memory until the next quiz event, where a page-view or click tag could read it. Both confirmed against the real container.
9. **Fails closed on a changed age question.** If the definition has no `age` question, or its options no longer include an under-18 option the code recognises, the helpers send nothing at all. Otherwise a reworded band would let minors' events through.
10. **Never breaks the quiz.** The helpers run inside `try/catch`, because they're called from the answer handlers before navigation. Version lookups use `Object.hasOwn`, so a version named `__proto__` can't throw.
11. **Completion needs every answer.** A visitor who opened a link to the last question and answered only that one sends no `quiz_complete`. Their real completion later is still counted.
12. **No logging.** Nothing in the analytics path writes to the console. (A temporary development log of saved gender values in `score-record.ts` has been removed separately.)

### The approval switch

`src/lib/analytics-approval.ts` exports `ANSWER_ANALYTICS_APPROVED = false`. Setting it to `true` changes three things together:
- The consent cookie version becomes `v2` in `src/lib/consent.ts`, so every earlier choice reads as undecided and the banner asks again.
- The banner shows the analytics wording that names answer-level collection (`ANALYTICS_DETAIL_WITH_ANSWERS` in `ConsentBanner.tsx`).
- `answer` is allowed for questions marked `forwardAnswer`.

While it's `false`, the banner, the consent cookie and the consent behaviour are exactly as in production today. The whole test suite passes with the switch set either way, so turning it on needs no test changes.

### One reviewed change to the consent manager

**The gap:** when the version moves to `v2`, a visitor who accepted under `v1` is asked again. If they now reject, their old `_ga` and HubSpot cookies were left in place, because the manager only cleared cookies for a choice it could read.

**The change:** `ConsentManager.save` now treats an unreadable or older choice as having granted everything. A "no" therefore clears those cookies too, with no reload, since nothing was loaded on the page.

With the switch off, this only affects a damaged consent cookie. Tests cover reject (cookies cleared) and accept (cookies kept).

### The under-18 page: kept free of trackers

Status: **implemented and deployed on 23 October 2026 (`2988d50` and `5b28615`), and verified in production** (test plan, section 3). Real Safari restoring a page from its back/forward cache is not verified.

**The problem it solves.** A GTM container already running can't be unloaded. Google's own automatic events (`user_engagement`, `scroll`) record the current page address and title. After an in-app hop to `/not-eligible`, both would say the visitor is under 18.

| Part | Where | What it does |
|---|---|---|
| Stop at the answer | `markUnder18()` in `not-eligible.ts`, from `QuizFlow` when the age answer is under 18, and from `leaveForNotEligible` | Once per tab: sends a Google consent update to **denied** to the tags already running, and sets `imageshield.under18` in sessionStorage. The quiz still asks the remaining questions, as before; nothing is tracked from the answer on |
| Full page load | `leaveForNotEligible()` in `src/lib/not-eligible.ts` | All seven redirects (`QuizFlow`; `DetailsForm` ×2; `OtpForm` ×2; `Calculating`; `ResumeSave`) call this instead of `router.push`/`replace`. It keeps the push/replace history behaviour |
| No trackers on the page | `trackingBlocked()` in `not-eligible.ts`, checked by `TrackingScripts`; `saidUnder18()` also checked by `track()` | GTM and HubSpot render nothing, and no quiz event is pushed, on `/not-eligible` or on any page in a tab that has said under 18 (current answers, or the flag), regardless of consent. That covers refresh, back, "Back to home" and direct visits. Correcting the age afterwards lets the visitor continue, as before, but the tab stays untracked |
| Back/forward cache | `reloadIfTrackingSurvived()`, on `pageshow` | A restored page that is now blocked but still has GTM or HubSpot running reloads itself, and the fresh page loads nothing |

`TrackingScripts` is the only place GTM or HubSpot are loaded. There's no middleware or server-side redirect, and `/public` holds only media. A blocked page's server HTML contains no tracker, because the scripts are only rendered after consent has been read in the browser.

## 6. Data flow of one answer (v11, "platforms")

1. The visitor ticks TikTok, then Instagram, then unticks TikTok. Each tick writes `answers.platforms` to `sessionStorage` (`imageshield.funnel.v1`). Nothing is pushed.
2. They press Continue. `QuizFlow` calls `trackAnswer(definition, "platforms")`, which:
   - sends `quiz_start` if none has gone yet;
   - checks the question against the map: the position, wording, options and multi flag must all match;
   - reads the stored answer and keeps only the defined options, in the quiz's order: `["Instagram"]`;
   - encodes it as `"Instagram"`.
3. `track()` checks consent, `dataLayer`, the under-18 rule, the payload, the allowlist (switch off, so `answer` is dropped) and duplicates, then pushes.
4. GTM processes the event. Once the UK team adds tags, a GA4 Event tag forwards the mapped parameters to GA4.
5. After code verification, `/calculating` posts all answers to `POST /v1/quiz/responses` through the app's own server. **This path is unchanged.** It is the backend's record of a verified visitor's answers and is used for scoring.

Nothing in this flow sends the visitor's name, email, phone number, code, account or score to GTM.

## 7. Partial answers from visitors who abandon

### 7.1 What exists today

- **Answers stay in the browser until the code is verified.** Before that they live only in `sessionStorage`. The web app's own documentation treats this as deliberate: "the answers go into sessionStorage and are submitted after" verification.
- **The backend stores answers only for verified accounts,** via `POST /v1/quiz/responses`, which needs a session.
- **There is no anonymous quiz-session or event endpoint.** Neither the web app's `/v1` client nor the API reference on file (`ImageShield-API-Reference.md`) has one.
- **The browser can't call `/v1` directly.** Production `/v1` rejects cross-origin requests from `quiz.imageshield.com`, so any ingestion has to go through the web app's own `/api` routes.
- **Per-visitor rate limiting at the backend doesn't work yet.** The backend sees one Amplify IP for all web traffic until the trusted forwarded-IP header asked for in `BACKEND-ASK-web-client-ip.md` exists.
- **The web app has no database.** It runs on Amplify as a thin server in front of `/v1`.

**Conclusion:** capturing abandoned answers needs new backend endpoints and a new table. That's work in the backend repository, which isn't in this workspace. It also needs legal approval first (see the privacy review), because it stores answers from people who never verified, for a purpose the current consent wording doesn't name. **This part is specified here, not built.**

### 7.2 Proposed API (backend `/v1`, reached through the web app's `/api`)

| Method and path | Body | Behaviour |
|---|---|---|
| `POST /v1/quiz/sessions` | `{ quiz_version, consent_version }` | Server generates a random 128-bit `session_id` and returns it with a short-lived signed session token. Rejects a version the API doesn't serve |
| `PUT /v1/quiz/sessions/{id}/answers/{question_key}` | `{ position, values: string[], committed_at }` | Upserts one row per (session, question). A retry replaces the same row, so it's idempotent. Validated against the definition for the session's version |
| `POST /v1/quiz/sessions/{id}/complete` | `{}` | Sets `completed_at` once; repeats are no-ops |
| `DELETE /v1/quiz/sessions/{id}` | - | Deletes the session and its answers (consent withdrawal, under-18) |

**Rules:**
- **Identifiers:** `session_id` is never a phone number, email, account id or device fingerprint. The browser keeps it in `sessionStorage` alongside the answers.
- **Fabricated sessions:** writes need the token issued at creation, so made-up session ids are rejected. Session creation is rate-limited per visitor (needs the forwarded-IP header) and globally.
- **Validation:** the quiz version must be one the API serves; the question key must be in that definition; values must be defined options (exactly one for single-select, at least one and none repeated for multi); bodies are capped at 4 KB.
- **Under-18:** if `age` is an under-18 option, the API deletes the session and accepts nothing more. The browser also stops sending.
- **Retries:** each committed answer is queued in a small `sessionStorage` outbox and removed when the `PUT` succeeds. The queue is retried on the next commit, on the browser's `online` event and on page load. Because writes are upserts, duplicate retries are harmless. **Known loss:** an answer committed while offline, followed by the tab being closed before reconnecting, is lost. Nothing waits for the final page or relies on `beforeunload` or `pagehide`.
- **Logs:** never log request bodies; log only status and session id.

### 7.3 Proposed tables

```
quiz_sessions
  id               uuid primary key       -- random, server-generated
  quiz_version     text not null
  consent_version  text not null          -- the wording the visitor accepted
  started_at       timestamptz not null
  completed_at     timestamptz null
  account_id       null                   -- only if legal approves linkage (7.4)
  expires_at       timestamptz not null   -- started_at + retention period

quiz_session_answers
  session_id    uuid references quiz_sessions on delete cascade
  question_key  text not null
  position      int  not null
  values        text[] not null           -- canonical option strings
  committed_at  timestamptz not null
  updated_at    timestamptz not null
  primary key (session_id, question_key)
```

A daily job deletes rows past `expires_at`. The retention period is configurable (`QUIZ_SESSION_RETENTION_DAYS`) and must be set by the privacy owner. The proposed default is 90 days.

### 7.4 Anonymous and verified sessions

**Default: never linked.** Verified visitors' answers already reach the backend through `POST /v1/quiz/responses`. Linking a session to the account would create a second copy of the same answers, attached to an identity, for no reporting benefit. Reports count sessions for the funnel and use stored responses only for scoring.

If legal approves linkage for a stated purpose, the web app's server would pass `session_id` with the authenticated responses call. The backend would then set `account_id` only when that session was created in the same tab within the retention window. A session id is never accepted from anywhere else.

### 7.5 Reports this enables (backend, aggregated)

These all come from `quiz_sessions` and `quiz_session_answers`:
- starts and completions
- abandonment by question and version (the highest `position` per incomplete session)
- option distribution, and frequencies for multi-select options
- completion rate by question
- differences between versions

Any figure that splits by `age`, `gender` or `prior_misuse` is suppressed when the group has fewer than 10 sessions (threshold to be confirmed by the privacy owner). Marketing gets aggregates, never rows.

### 7.6 Migration and deployment plan

1. Legal approves the purpose, consent wording, retention period, access roles and linkage decision (privacy review, section 6).
2. Backend: add the tables, endpoints, validation, the deletion job and the forwarded-IP header; deploy to dev.
3. Web app: add `/api/quiz-session` routes that forward to `/v1`, plus the browser outbox, behind their own switch. Collection only runs when that switch is on and the visitor gave the approved consent.
4. On dev, run the end-to-end proof: answer three questions, close the browser, then query the backend and confirm a session with three answers and no completion. Repeat with retries, offline, under-18 and consent withdrawal.
5. Production deploy; repeat step 4 against production with a test visitor and delete the test sessions afterwards.

**Abandoned-session collection must not be described as working until step 4 passes.**

## 8. Files

| File | Role |
|---|---|
| `src/lib/analytics.ts` | Event schema, validation, consent, under-18 and duplicate rules, quiz helpers |
| `src/lib/analytics-quiz-map.ts` | Reviewed per-version question map |
| `src/lib/analytics-approval.ts` | The legal approval switch |
| `src/lib/consent.ts` | Consent version follows the switch (`v1` / `v2`) |
| `src/components/consent/ConsentBanner.tsx` | Current and drafted analytics wording |
| `src/components/quiz/QuizFlow.tsx` | Calls `trackStart`, `trackAnswer`, `trackComplete` |
| `src/lib/quiz.ts` | `recognisesMinors()`, so analytics can fail closed |
| `src/lib/not-eligible.ts` | Full-page redirect for under-18s, tracker block, back/forward-cache guard |
| `src/components/consent/TrackingScripts.tsx` | Loads nothing when `trackingBlocked`; registers the cache guard |
| `QuizFlow`, `DetailsForm`, `OtpForm`, `Calculating`, `ResumeSave` | Redirect through `leaveForNotEligible` |
| `src/components/consent/ConsentManager.tsx` | Clears an outdated choice's cookies on a new "no" |
| `src/lib/analytics.fixtures.ts` | Test helper: definitions built from the map |
| Tests | `analytics.test.ts`, `analytics.approved.test.ts`, `analytics.denylist.test.ts`, `QuizFlow.test.tsx`, `QuizFlow.approved.test.tsx`, `ConsentBanner.test.tsx`, `ConsentBanner.approved.test.tsx`, `ConsentManager.test.tsx`, `consent.test.ts` |
