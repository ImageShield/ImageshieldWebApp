# Quiz analytics: GTM and GA4 setup

**For:** the UK analytics team setting up Google Tag Manager and Google Analytics 4 for the ImageShield quiz at `https://quiz.imageshield.com`.
**Container:** `GTM-NM7B8G3X`
**Prepared:** 23 October 2026 (updated the same day for the under-18 safeguard)

This document should be enough on its own: you shouldn't have to guess an event name, a variable key or a setting. Where a step depends on another team, it says so.

A note on the separator character. Multi-select answers are joined with a vertical bar. To avoid confusion with table formatting, this document writes it as **`|` (vertical bar)** and only shows it inside code blocks.

## 1. Status and prerequisites

| Item | Status | Owner |
|---|---|---|
| The quiz pushes `quiz_start`, `quiz_answer`, `quiz_complete` | **Built, not yet released.** The live site doesn't push them yet | ImageShield dev team |
| Answer values (`answer`) | **Switched off** until legal approves. Until then `answer` is always empty | Legal, then the dev team |
| GTM loads only after a visitor accepts analytics cookies | **Live.** Checked on the live site on 22 October | Done |
| Container `GTM-NM7B8G3X` | **Published version has no tags, triggers or GA4 ID** (read from the public container file on 22 October). Nothing reaches GA4 today | You |
| GA4 property for the quiz | **Not created** (see 5.4) | You |
| Under-18 safeguard in the quiz | **Built and tested locally, not yet released.** Once released, under-18 visitors reach `/not-eligible` with a full page load, and GTM and HubSpot never load on that page or anywhere else in their browser tab | ImageShield dev team: release |

You can build everything now. The quiz events will only appear in GTM Preview once the dev team confirms the release. **Do not publish the container** until section 8 passes.

## 2. The three events

| Event | Fires when |
|---|---|
| `quiz_start` | The first quiz question a visitor sees is on screen, whether they came from the intro, a direct link or a return visit. If they accept cookies partway through, it is sent with the question they're on, just before that question's answer |
| `quiz_answer` | An answer is committed. Single-answer question: the tap. "Select all that apply" question: the **Continue** button, with the final selection. Ticking and unticking sends nothing |
| `quiz_complete` | The last question is answered **and** every earlier question has an answer. This is the end of the questions, not the details form, code or score |

**Counting rules:**
- Each event is sent **at most once per browser tab**; `quiz_answer` once per question.
- Going back and changing an answer, refreshing, or using back/forward does **not** send it again. The first committed answer is the one counted.
- A new tab is a new visit.
- If the quiz version changes during a visit (rare: a release mid-quiz), the visitor answers again and the events are sent again under the new `quiz_version`.

**The quiz sends no events:**
- before the visitor accepts analytics cookies, or after they decline;
- for steps taken before a mid-quiz "Accept" (tracking starts at that point);
- after the visitor withdraws consent (stops immediately);
- once the visitor answers "Under 18" (no further quiz events, including that answer). The quiz still asks the remaining questions; at the end it loads the not-eligible page as a new page, where GTM is never loaded.

## 3. Fields

Every quiz event contains **all five keys**. A key the event doesn't use is set to `undefined`. In Tag Assistant → Variables an `undefined` key shows as *undefined*, and the GA4 Event tag leaves that parameter out, so it never appears in DebugView.

Straight after each quiz event, the quiz sends **a second message with no event name** that sets all five keys to `undefined`. This stops an answer lingering in GTM's memory where another tag could read it. In Tag Assistant it appears as an unnamed **Message**; ignore it.

| Data layer key | Set on | Meaning | Example |
|---|---|---|---|
| `quiz_version` | all three | Which quiz version was answered | `likeness-health-v11` |
| `question_number` | `quiz_start`, `quiz_answer` | Question position, from 1. On `quiz_start`, where the visitor started | `3` |
| `question` | `quiz_answer` | Which question (section 4) | `platforms` |
| `answer` | `quiz_answer` | Chosen option(s), only for approved questions and only once approved | see below |
| `question_count` | `quiz_complete` | Number of questions in that version | `6` |

**Multi-select** (only `platforms`): the chosen options joined with a vertical bar, no spaces, always in the quiz's own order whatever order they were ticked in. All six together is 54 characters, under GA4's 100-character limit.

### Exact pushes

```js
// quiz_start
{ event: "quiz_start", quiz_version: "likeness-health-v11", question_number: 1,
  question: undefined, answer: undefined, question_count: undefined }

// quiz_answer, gender (never has an answer)
{ event: "quiz_answer", quiz_version: "likeness-health-v11", question: "gender",
  question_number: 2, answer: undefined, question_count: undefined }

// quiz_answer, platforms (answer only after approval; ticked TikTok, then X, then Instagram)
{ event: "quiz_answer", quiz_version: "likeness-health-v11", question: "platforms",
  question_number: 3, answer: "X (Twitter)|Instagram|TikTok", question_count: undefined }

// quiz_complete
{ event: "quiz_complete", quiz_version: "likeness-health-v11", question_count: 6,
  question: undefined, question_number: undefined, answer: undefined }

// after every one of the above
{ quiz_version: undefined, question: undefined, question_number: undefined,
  answer: undefined, question_count: undefined }
```

## 4. Questions and answers by quiz version

Production runs **`likeness-health-v11`**; development runs `likeness-health-v17`. The position of a question differs between versions, so **group reports by `question`, never by `question_number`.**

### `likeness-health-v11` (production)

| `question_number` | `question` | Asks | Type | `answer` (once approved) |
|---|---|---|---|---|
| 1 | `age` | Age | single | never sent |
| 2 | `gender` | Gender | single | never sent |
| 3 | `platforms` | Which platforms do you use? | multi | see list A |
| 4 | `posting_volume` | How often are photos of you shared online, by you or others? | single | see list B |
| 5 | `prior_misuse` | Have your photos or likeness been misused before? | single | never sent |
| 6 | `monitoring_method` | How do you monitor how your likeness is used online? | single | see list C |

### `likeness-health-v17` (development)

Same `question` names and answer values as v11, except:
- `prior_misuse` is number 4 and `posting_volume` is number 5;
- `posting_volume` asks "How often do you post new images of yourself?". That's a different question, so don't combine it with v11's `posting_volume`.

### Answer values, exactly as sent

```
A  platforms (any combination, joined in this order):
   X (Twitter)
   Snapchat
   Instagram
   Facebook
   TikTok
   YouTube
   e.g.  X (Twitter)|TikTok

B  posting_volume (one of):
   Rarely (less than once a month)
   Around once a month
   Weekly
   Daily or multiple times a day

C  monitoring_method (one of):
   I don’t have a way to monitor my likeness
   I rely on friends and family to tell me what they've seen
   I subscribe to a likeness detection/monitoring service
```

List C's first option uses a curly apostrophe (`don’t`); the second uses a straight one (`they've`). To avoid typing them, filter with **begins with** `I don`, `I rely`, `I subscribe`.

**Never sent to GA4: age, gender, prior misuse.** These answers are sensitive. Aggregate figures for them can only come from ImageShield's own backend.

**A new quiz version** arrives with its own `quiz_version` and **no** `answer` values until the dev team reviews it. Until then, its `question` values may be the backend's own codes (for example `q_il8uju`).

## 5. GTM configuration

### 5.1 Built-in variables

Variables → Configure: enable **Event**, **Page Hostname**, **Page Path**.

### 5.2 Constant

| Name | Type | Value |
|---|---|---|
| `Const - GA4 quiz ID` | Constant | the quiz property's measurement ID, `G-…` (see 5.4) |

### 5.3 Data Layer Variables

Variables → New → **Data Layer Variable**, Data Layer Version **Version 2**, "Set Default Value" **unticked**.

| Variable name | Data Layer Variable Name |
|---|---|
| `DLV - quiz_version` | `quiz_version` |
| `DLV - question` | `question` |
| `DLV - question_number` | `question_number` |
| `DLV - answer` | `answer` |
| `DLV - question_count` | `question_count` |

Use these five variables **only** in the `GA4 - Event - quiz funnel` tag. Don't add them to the Google tag's shared settings or to any other tag.

### 5.4 GA4 property: use a new one

Create a **new GA4 property** for the quiz:
- Admin → Create → Property: time zone **(GMT+00:00) United Kingdom Time**, currency **GBP**;
- add a **Web** data stream for `https://quiz.imageshield.com`;
- use its `G-` ID in `Const - GA4 quiz ID`.

**Don't reuse `G-S8ZFJXY5DT`** (imageshield.com's property). Several settings in section 6 apply to a whole property or stream, and they would change imageshield.com's reporting too. Quiz visitors would count as separate users from the main site either way, because the cookie domains differ.

### 5.5 Triggers

**`Init - quiz host`**
- Type: **Initialization**
- This trigger fires on: **Some Initialization Events**
- Conditions (all must match):
  - `Page Hostname` **equals** `quiz.imageshield.com`
  - `Page Path` **does not contain** `not-eligible`

**`CE - quiz funnel`**
- Type: **Custom Event**
- Event name, typed exactly with plain vertical bars and no backslashes:

```
^(quiz_start|quiz_answer|quiz_complete)$
```

- Tick **Use regex matching**
- This trigger fires on: **Some Custom Events**, `Page Hostname` **equals** `quiz.imageshield.com`

### 5.6 Tags

**`GA4 - Google tag - quiz`**
- Tag type: **Google tag**
- Tag ID: `{{Const - GA4 quiz ID}}`
- Configuration settings (Configuration parameter → Value; type `false` in lower case):

| Configuration parameter | Value |
|---|---|
| `cookie_domain` | `quiz.imageshield.com` |
| `allow_google_signals` | `false` |
| `allow_ad_personalization_signals` | `false` |

- Triggering: `Init - quiz host`

**`GA4 - Event - quiz funnel`**
- Tag type: **Google Analytics: GA4 Event**
- Measurement ID: `{{Const - GA4 quiz ID}}`
- Event Name: `{{Event}}`
- Event parameters:

| Parameter name | Value |
|---|---|
| `quiz_version` | `{{DLV - quiz_version}}` |
| `question` | `{{DLV - question}}` |
| `question_number` | `{{DLV - question_number}}` |
| `answer` | `{{DLV - answer}}` |
| `question_count` | `{{DLV - question_count}}` |

- Triggering: `CE - quiz funnel`

### Why these settings matter

| Setting | Reason |
|---|---|
| Hostname conditions | imageshield.com loads this same container and has its own GA4 tag. Without them, every page view there would be counted twice |
| `not-eligible` exclusion | Extra protection only: that page's address and title say the visitor is under 18, and the quiz already never loads GTM there |
| `cookie_domain` | Keeps GA's cookies on `quiz.imageshield.com`, where the quiz deletes them when someone withdraws consent. On the default setting they'd land on `.imageshield.com` and survive |
| Signals and ad personalisation off | Quiz data must not feed advertising |
| No consent tags | Don't add a consent-mode template or tag. The quiz sets Google's consent signals itself, before the container starts |

### Please do not

- add click triggers or Click Text / Click Element variables on quiz pages. The answer buttons' text **is** the answer, including for gender and past misuse;
- read form fields on the details page, or set a User-ID from email or phone;
- attach any other tag (Ads, Meta, HubSpot) to `CE - quiz funnel`;
- add a **History Change** trigger or tag. The quiz changes screens without full page loads, and a history page view of `/not-eligible` reveals an under-18 visitor.

## 6. GA4 property settings (the new quiz property)

| # | Setting | Where (GA4, 2026) | Value |
|---|---|---|---|
| 1 | Custom dimensions | Admin → Data display → Custom definitions → Create custom dimension | Five dimensions. For each: Dimension name = Event parameter = `quiz_version`, `question`, `question_number`, `answer`, `question_count`; Scope = **Event** (never User). Create them **before publishing**; they aren't retroactive |
| 2 | Key event | Admin → Data display → Key events → New key event | `quiz_complete`, counting **Once per event** |
| 3 | Data retention | Admin → Data collection and modification → Data retention | Event data retention **2 months**. Detailed explorations reach back 2 months; standard reports are unaffected |
| 4 | Google signals | Admin → Data collection and modification → Data collection | **Off** (property-wide) |
| 5 | Enhanced measurement page views | Admin → Data streams → quiz stream → Enhanced measurement → Page views (gear) → Show advanced settings | "Page changes based on browser history events" **Off**. There is no URL exclusion option |
| 6 | Under-18 masking (optional) | Admin → Data display → Events → Modify event → Create | **Optional extra protection.** The quiz itself now keeps GTM off `/not-eligible`, so nothing should arrive from that page. If you want a second layer: name `mask not-eligible`; condition `page_location` contains `not-eligible`; modify `page_location` → `https://quiz.imageshield.com/` and `page_title` → `ImageShield` |
| 6a | Consent check on GA4 tags | GTM → each GA4 tag → Advanced Settings → Consent Settings | **Require additional consent for tag to fire:** `analytics_storage`. Before leaving for `/not-eligible`, the quiz tells running Google tags that consent is denied; this setting makes your tags stop rather than send cookieless pings |
| 7 | Redaction | Admin → Data streams → quiz stream → Redact data | Email redaction **On**; query parameter redaction for `email`, `phone` |
| 8 | User-provided data | Admin → Data collection and modification → Data collection | **Off** |
| 9 | Test traffic | Admin → Data collection and modification → Data filters → Create | Filter type **Developer traffic**, state **Active**. GTM Preview traffic is marked as debug traffic, so this keeps test runs out of reports |
| 10 | Access | Admin → Property access management | Send the user list to the privacy owner |

## 7. Reports

| Question | How (GA4) |
|---|---|
| Unique quiz starts | Event count of `quiz_start`, one per tab. GA4 "sessions" are a different unit |
| Completion rate | Exploration: `quiz_complete` ÷ `quiz_start`, broken down by `quiz_version`. Or Admin → Data display → Custom definitions → Custom metrics → **Calculated metric** |
| Drop-off by question | Explore → Funnel exploration, **open funnel**, "indirectly followed by". Steps: `quiz_start`; then `quiz_answer` where `question` = `age`, `gender`, `platforms`, `posting_volume`, `prior_misuse`, `monitoring_method` (v11 order; for v17 swap `posting_volume` and `prior_misuse`); then `quiz_complete`. Add `quiz_version` exactly matches the version as a segment or step condition |
| Answers per question | Free form: event `quiz_answer`, rows `question` |
| Option distribution (after approval) | Free form: `quiz_answer`, rows `question` then `answer` |
| Platform frequency | Filter `question` = `platforms` and `answer` **contains** each platform name |
| Partial vs completed | Segment: sessions with `quiz_start` and without `quiz_complete`, against those with both |
| Last question reached per visitor | Not available in the GA4 interface. Needs a BigQuery export link (Admin → Product links → BigQuery): take the highest `question_number` per visit without `quiz_complete`. The export keeps raw data until you delete it, so agree a retention period with the privacy owner first |
| Version differences | Any of the above, compared across `quiz_version` |

**Notes on reading these reports:**
- **Visitors who accept partway** start at a later `question_number`. They are missing from step 2 of a closed funnel, which is why the funnel should be open.
- **Under-18 visitors** stop after `quiz_start` and look the same as people who left at question 1.
- **Small groups** may be hidden by GA4 thresholds.

**Needs ImageShield's backend, not GA4:** distributions for age, gender and past misuse, and the answers of visitors who left before verifying. Neither is built yet; both need legal approval.

## 8. Testing checklist

Use GTM Preview, after the dev team confirms the release. Use test answers only: an adult age (except in step 8) and no real personal details.

1. **Connect.** GTM → Preview → `https://quiz.imageshield.com/quiz`. Tag Assistant shows "not connected" until you click **Accept all** on the cookie banner in the new tab; then it connects. If it times out, start Preview again. Under **Consent**, expect `analytics_storage` = granted.
2. **Full run.** Click "Let's begin", answer all six questions with an adult age, tick two platforms.
   - Ignore Consent, Initialization, Container Loaded, DOM Ready, Window Loaded and unnamed **Message** entries.
   - The quiz entries, in order: `quiz_start` (`question_number` 1); six `quiz_answer` (`question` = age, gender, platforms, posting_volume, prior_misuse, monitoring_method); `quiz_complete` (`question_count` 6).
   - `GA4 - Event - quiz funnel` fired on each of those eight and on nothing else. The details form, code and score add no quiz entries.
3. **Values.** Open each `quiz_answer` → Variables.
   - **While answers are switched off:** `DLV - answer` is *undefined* on every one.
   - **After approval:** `DLV - answer` is filled only on `platforms`, `posting_volume` and `monitoring_method`, and *undefined* on `age`, `gender` and `prior_misuse`. Check `prior_misuse` especially: in v11 it comes straight after `posting_volume`. The unnamed Message after each event should show every DLV as *undefined*.
4. **DebugView.** GA4 → Admin → Data display → DebugView shows the same eight events with their parameters. You'll also see `page_view`, `session_start`, `first_visit`, `user_engagement` and possibly `scroll`; that's expected.
5. **Duplicates.** Go back to question 2, change the answer, continue: no second `quiz_answer` for `gender`. Refresh a question page: no second `quiz_start`.
6. **Reject.** New private window, **Reject all**, take the quiz. Tag Assistant never connects; DebugView shows nothing new.
7. **Withdraw.** Accept, answer two questions, click **Cookie settings** at the foot of the page, untick Analytics, **Save choices**. The page reloads and Tag Assistant shows disconnected. Nothing new in DebugView for two minutes.
8. **Under 18.** New private window, **Accept all**, answer "Under 18", then answer the remaining questions.
   - Expect `quiz_start` only, then nothing from the quiz. Under **Consent** you'll see one update to **denied** straight after the "Under 18" answer; the remaining questions are still asked, with consent denied.
   - After the last question the page **reloads** at `/not-eligible`, and Tag Assistant shows disconnected: GTM isn't on that page.
   - In DebugView, no event may show `page_location` or `page_title` mentioning `not-eligible` or "18 or older".
   - Press the browser's **Back** button, then refresh `/not-eligible`. Tag Assistant stays disconnected each time.
   - Repeat with the order reversed: open `https://quiz.imageshield.com/not-eligible` directly and click **Accept all** there. Expect nothing in DebugView.
   - In the browser's developer tools (Network, filter `collect`), check whether any request was sent while the page changed. Expect none if 6a is set. If one appears, it must carry no `not-eligible` in its `dl` and `gcs=G100` (consent denied); report it otherwise.
9. **imageshield.com.** In Tag Assistant, add `https://imageshield.com` (accept its cookie banner if shown). Neither quiz tag appears under Tags Fired.

Then **Submit → Publish**. Realtime shows events within minutes; standard reports fill in over 24–48 hours.

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Tag Assistant won't connect | Cookies not accepted in the preview tab; an ad blocker; or the quiz release isn't live |
| No quiz events in Preview | Quiz release not live, or analytics declined |
| Trigger never fires | The regex was pasted with backslashes; retype it as in 5.5 |
| `answer` filled on `age`, `gender` or `prior_misuse` | Must never happen. Pause the GA4 Event tag and report it to the dev team immediately |
| Page views doubled on imageshield.com | A hostname condition is missing |
| `not-eligible` in any stored event, or Tag Assistant connected on `/not-eligible` | Must not happen once the quiz update is live. Pause the GA4 tags and report it to the dev team |

**When reporting a problem, send:**
- the exact error text or a screenshot;
- where it appeared (GTM, Tag Assistant or GA4);
- the URL and the time;
- your browser and extensions;
- whether the workspace has unpublished changes.

A container export lets the dev team check the setup without changing the live container.
