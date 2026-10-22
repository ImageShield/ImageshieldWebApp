# Quiz analytics: privacy review

**For:** ImageShield's legal and privacy owner.
**Purpose:** set out exactly what the quiz analytics collect, where the data goes and who sees it, and list the decisions needed before each part can go live.
**Prepared:** 22 October 2026, from the web app's code, the live quiz definitions, the live consent banner and the published privacy notice.

Nothing described here as "proposed" is collected today. Items marked **unknown** could not be checked from the web app and need confirming by their owner.

## 1. Summary of what needs approval

| # | Decision | Recommended |
|---|---|---|
| A | Send quiz **progress** (start, which question was answered, completion, quiz version) to GA4 | Ready to go: covered by the current consent wording ("which screens people reach and where they stop") |
| B | Send the **chosen options** for three questions to GA4: platforms used, how often photos are shared, how likeness is monitored | Approve the banner wording in section 4, add the quiz section to the privacy notice, then switch on |
| C | Send age, gender or past-misuse answers to GA4 | **Not recommended.** Built so they can't be sent; would need a separate decision |
| D | Store **partial answers** (including sensitive ones) from visitors who leave before verifying, in ImageShield's backend | Needs a decision on purpose, consent, retention and access (section 6). Specified, not built |
| E | Link a partial session to an account once the visitor verifies | Not recommended: duplicates data already held |
| F | Send under-18 visitors to `/not-eligible` with a full page load and no GTM on that page | **Built and tested locally, not yet deployed** (section 7a) |

## 2. The quiz questions and their sensitivity

Live production quiz `likeness-health-v11` (22 October 2026):

| Question | Options | Assessment |
|---|---|---|
| Age | Under 18, 18-24, 25-34, 35-54, 55+ | Personal data; under-18 answers are refused and never tracked |
| Gender | Female, Male, Non-Binary, Prefer not to say | Can reveal gender identity; treated as sensitive |
| Platforms used (multi) | X (Twitter), Snapchat, Instagram, Facebook, TikTok, YouTube | Behavioural, low sensitivity |
| How often photos are shared | Rarely … Daily | Behavioural, low sensitivity |
| Prior misuse of images | No known incidents, Once or twice, Happens regularly | Reveals victimisation; treated as sensitive |
| How likeness is monitored | None / friends and family / a monitoring service | Behavioural, low sensitivity |

## 3. Field inventory

### 3.1 GA4 via GTM (only after analytics consent)

| Field | Meaning | Personal / sensitive | Collected in | Stored in | Sent to | Purpose | Access | Retention | Approval |
|---|---|---|---|---|---|---|---|---|---|
| `event` | `quiz_start`, `quiz_answer`, `quiz_complete` | No | Browser | GA4 | Google (GA4) | Funnel analytics | GA4 property users (**unknown list**) | GA4 setting, **unknown** (recommend 2 months) | A |
| `quiz_version` | Quiz version answered | No | Browser | GA4 | Google | Funnel analytics | as above | as above | A |
| `question` | Which question | No (every visitor gets every question) | Browser | GA4 | Google | Funnel analytics | as above | as above | A |
| `question_number`, `question_count` | Position; number of questions | No | Browser | GA4 | Google | Funnel analytics | as above | as above | A |
| `answer` for platforms, photo sharing, monitoring | Chosen option(s) | Personal (linked to a GA client ID), low sensitivity | Browser | GA4 | Google | Understand the audience | as above | as above | **B** |
| `answer` for age, gender, prior misuse | — | — | **Never sent** | — | — | — | — | — | C (not proposed) |
| GA automatic data: `_ga` client ID cookie, page address and title, referrer, device and browser, approximate location from IP | Standard GA4 collection | Personal (online identifier) | Browser | GA4 (GA4 doesn't store IP addresses) | Google | Analytics | as above | as above | A; covered by the privacy notice's Google Analytics paragraph |
| GTM diagnostics request (`googletagmanager.com/td`) | Google's own tag diagnostics, seen once in testing | Contents not inspected | Browser | Google | Google | Google's service | Google | Google's terms | Note for review |

**Never sent to GTM/GA4:** name, email, phone number, verification code, session tokens, account id, score, risk band.

**Enforcement:** these are enforced in code and covered by tests: built field by field, allowlisted, and blocked without consent or for under-18s.

### 3.2 Browser storage (essential, the visitor's own device)

| Key | Contents | Type | Lifetime |
|---|---|---|---|
| `imageshield.funnel.v1` (sessionStorage) | Answers, quiz version, phone number after the details form, resend timer, last step | Essential: the quiz itself | Until the tab closes |
| `imageshield.analytics.v1` (sessionStorage) | Names of events already sent (no answers) | Written only after analytics consent | Until the tab closes |
| `imageshield_consent` (cookie) | The visitor's choice, e.g. `v1.a1.m0` | Essential | 182 days |

### 3.3 ImageShield backend (`/v1`), existing

| Data | When | Purpose | Access | Retention |
|---|---|---|---|---|
| All quiz answers, quiz version, score; name, email, phone | After the visitor verifies their phone number and the answers are submitted | Score the visitor; their account | Backend and database operators (**unknown list**) | Privacy notice: "as long as you keep using" the service; 30-day deletion after an account deletion request. **Unclear for someone who only took the quiz and never used the app** |

### 3.4 Proposed: partial sessions (decision D, not built)

| Field | Personal / sensitive | Purpose | Proposed access | Proposed retention |
|---|---|---|---|---|
| `session_id` (random; not a phone, email or device ID) | Pseudonymous | Group one visitor's answers | Backend service only | With the session |
| `quiz_version`, `consent_version`, `started_at`, `completed_at` | No | Funnel | Analysts, aggregated | 90 days (configurable) |
| Each committed answer: question key, position, chosen option(s), time | **Yes for age, gender and prior misuse** | Funnel and answer analysis, including visitors who left | Aggregates only for marketing; rows for named analysts | 90 days, then deleted automatically |
| `account_id` | Personal | Only if decision E is approved | — | — |

**Not stored:** IP address (used only in memory for rate limiting), user agent, name, email, phone.

## 4. Consent: what the current wording covers

**Current analytics wording (live, consent version `v1`):**

> Google Tag Manager, and any measurement tools we run through it, such as Google Analytics where enabled: which screens people reach and where they stop.

This covers decision A. It does **not** name quiz answers, so it does not cover B or D.

**Drafted wording for B** (already in the code, shown only after approval):

> Google Tag Manager, and Google Analytics through it: which quiz questions people reach, where they stop, and the options chosen for some questions — which platforms you use, how often photos of you are shared, and how you monitor your likeness. Never your age, gender, experience of misuse, name, email or phone number.

Summary line becomes: "we use Google Tag Manager to see how the quiz is used, including some of your answers, …".

**How approval is applied:** one switch in the code (`ANSWER_ANALYTICS_APPROVED`). Turning it on shows this wording and moves consent to `v2`, so **every visitor who chose under the old wording is asked again**. An earlier "yes" is never read as a "yes" to sending answers. Turning it off reverses all three.

**Decision D** is a different purpose (ImageShield storing answers, including sensitive ones, from people who never finished). It needs its own wording. Treating it as essential, or as covered by an analytics "no", would not be appropriate. Possible wording, for the owner to decide:

> Quiz research (ImageShield): we keep your quiz answers for 90 days, even if you don't finish, to understand how people use the quiz. Not linked to your name or phone number.

## 5. The privacy notice

The published notice at imageshield.com/privacy-policy (effective 23 September 2025):
- names Google Analytics generally and says site-use information including IP address may be shared with analytics providers;
- does **not** mention the Likeness Health Quiz, the categories of answers it asks for (gender, past misuse of images), Google Tag Manager, or how long analytics or quiz data is kept;
- gives specific retention only for biometric data;
- describes children's data for under-13s; the quiz refuses under-18s, which is stricter and consistent.

**Needed before B or D:** a quiz section covering:
- what the quiz asks;
- that answers are used to calculate the score;
- which answers go to Google Analytics, for what, and how long they're kept there;
- whether and how long partial answers are kept (D);
- how to withdraw ("Cookie settings" at the foot of every page);
- how to ask for deletion.

## 6. Questions for the legal and privacy owner

1. Approve decision B: the three questions, the wording in section 4, and GA4 as the destination?
2. Confirm age, gender and prior misuse stay out of GA4 (decision C)?
3. For decision D:
   - What is the purpose?
   - Is consent the basis, and under which wording?
   - Is 90 days the right retention for incomplete sessions?
   - Which roles may see rows rather than aggregates?
   - What minimum group size applies to sensitive aggregates (proposed: 10)?
4. Decision E: should sessions ever be linked to accounts?
5. Retention for quiz-only visitors' verified records in the backend (section 3.3)?
6. GA4 property: who has access, the data retention setting, and confirmation that Google signals and ad personalisation are off for quiz data?
7. Does the GTM diagnostics request (section 3.1) need any disclosure?
8. Who updates the privacy notice, and should the banner change wait for it?

## 7a. The under-18 page and Google's automatic events

The quiz itself sends nothing after an "Under 18" answer. However, a GA4 Google tag that has already loaded keeps sending its own automatic events, such as `user_engagement` and `scroll`. These carry the current page address and title. After the in-app navigation to `/not-eligible`, both reveal the visitor's age band: the title is "You need to be 18 or older".

- **No exposure today.** The container has no GA4 tags.
- **The safeguard (decision F), built and tested locally, not yet deployed:**
  - All five screens that turn an under-18 visitor away now load `/not-eligible` as a new page instead of an in-app hop (seven call sites).
  - Just before leaving, tags already running are told consent is denied. The visitor's stored choice is unchanged.
  - GTM and HubSpot never load on `/not-eligible`, nor on any page in a browser tab whose stored answers say under 18. That covers refresh, the back button, "Back to home" and opening the page directly, whatever the visitor accepted.
  - A page restored from the browser's back/forward cache with a tracker still running reloads itself.
- **Optional extra protection, for the UK team:** exclude `/not-eligible` from the Google tag's trigger, turn off history-based page views, and add a GA4 "Modify event" rule that masks the address and title. With the safeguard live, none of these should ever have anything to act on.
- **Two residual points, both needing a production check:**
  - **A final ping on the way out.** As the quiz page unloads, a Google tag may send one last ping. It would carry the quiz page's own address, never `/not-eligible`, with consent already denied; under consent mode's "advanced" behaviour it would be cookieless. Requiring `analytics_storage` consent on the GA4 tags (handoff, section 6 item 6a) stops it entirely.
  - **Back/forward cache restores.** Covered by the reload guard, but headless Chrome never restored a page, so this needs checking in Safari, which caches more pages.

  Exact steps: handoff section 8, step 8.

## 7. Safeguards that stay in place

- No GTM, and no events, before analytics consent. A "Reject all" sends nothing.
- Withdrawing consent stops events immediately, deletes this site's analytics cookies, and reloads the page without GTM.
- Accepting partway sends nothing from before acceptance.
- Under-18 answers stop all tracking and are turned away from the quiz, as before.
- No answer for age, gender or prior misuse can reach the dataLayer. This holds even if code calls the tracking function directly, or if the question map is edited by mistake: it's a fixed rule in code, and it's tested.
- If the backend changes the age question so an under-18 answer can't be recognised, analytics sends nothing at all rather than risk tracking a minor.
- Once the code is deployed, GTM and HubSpot never load on `/not-eligible` or for a tab that has answered under 18 (section 7a).
- After each event the quiz clears its fields in GTM, so no answer lingers for other tags to read.
- When consent is asked again after a wording change, a new "no" also deletes cookies left by the earlier "yes".
- Nothing in the analytics code logs to the console. A temporary development log that printed saved gender values on the score page has been removed.
