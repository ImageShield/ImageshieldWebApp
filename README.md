# ImageShield Web

The quiz funnel and landing pages. Mobile browser first — most visitors arrive on a
phone, so every screen is designed for a thumb and a flaky connection.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Plus Jakarta Sans

## Running it

```bash
cp .env.example .env.local   # then fill in IMAGESHIELD_API_URL and FUNNEL_SECRET
npm run dev
```

### Without the API

```bash
npm run dev:offline          # next dev + a stand-in /v1 on :5099
```

Runs the app against `tools/dev-api/`, which implements the contract faithfully — the
quiz definition, answered without a session, included — so the whole funnel walks. The
OTP code is `123456`. Editing `tools/dev-api/quiz.json` WHILE a tab sits mid-quiz is how
to reproduce a definition that moved under a visitor and watch the retake path, which is
what a deploy mid-funnel looks like. It is also the only way to reach the states a real
backend won't produce to order: a score that isn't ready, a write that fails once, an
access token about to expire. See the knobs at the top of `tools/dev-api/server.mjs`.

## How it's put together

```
src/
  app/          route per funnel screen
  components/   Screen shell + primitives
  lib/
    funnel.ts         step order — the single source of truth for what follows what
    funnel-state.ts   answers + quiz version, persisted to sessionStorage
    session.ts        the /v1 token pair, and the cookies either side of sign-in
    quiz.ts           the shapes of a quiz, and answer validation
    quiz-definition.ts  reads GET /v1/quiz — once without a session, once with
    use-quiz-definition.ts  that definition, fetched once per tab, shared by 5 screens
    score.ts          how a served score is presented — no thresholds of its own
    v1/               server-only client for the /v1 API
    quiz-submit.ts    posting the answers, shared by the two screens that do it
tools/
  dev-api/      a stand-in /v1, for `npm run dev:offline`. Never imported by src/
```

Three conventions worth keeping, because they're what make design churn cheap:

**Tokens live in `src/app/globals.css`.** Colours, spacing, and the content column are
defined once in the `@theme` block, mirrored from the mobile app. A redesign should be
edits to those values — components shouldn't carry hardcoded hexes or pixel sizes.

**Step order lives in `src/lib/funnel.ts`.** Screens ask `nextPath()` where to go, so
moving a step is one array edit rather than a hunt through every `router.push`. It has
earned that twice over — the questions have moved either side of the phone number and
back again.

```
landing → quiz (intro, marketing copy) → quiz/questions → details → otp → calculating → score
                                          ^ answered, kept   ^ phone verified   ^ written
                                            in this tab                           to /v1
```

The questions come first so that the number is asked of someone who has a score
waiting for them, and `GET /v1/quiz` is answered without a session, so that ordering
costs nothing: the questions in front of the form are the server's own. This repo used
to carry a hand-copied `quiz-content.ts` because that read needed a token; it does not,
and the copy is gone.

The browser does not call the API directly. `GET /api/quiz-definition` is the read, and
it exists because the API host is server-only config — no `NEXT_PUBLIC_` prefix, so it
never ships in a bundle — and because a browser-side call would need CORS from a service
with no reason to grant it. Five screens want the definition, so the upstream read is
cached for five minutes and `useQuizDefinition` fetches it once per tab.

The server still has the last word. `POST /v1/quiz/responses` validates the answer keys
and values against the live definition, so `/api/quiz` re-reads that definition and
checks the answers against it before writing. Both reads hit the same endpoint, so they
normally agree — the case the re-read exists for is a deploy that lands while someone is
mid-quiz. That surfaces as a 409 the funnel words itself, "the quiz has been updated",
and the visitor re-answers on the session they already have, without being texted a
second code.

**Answers save on change, not on submit.** Mobile browsers kill background tabs; a user
who takes a call mid-quiz has to come back to their answers still there. See
`funnel-state.ts`.

## Talking to the API

The browser never calls the API directly. Route handlers under `src/app/api/` go
through `src/lib/v1/`, so the tokens, the OTP send policy and the abuse rules stay on
this side where they can't be bypassed.

**The session is the identity.** No /v1 route accepts an account id, person id or
phone number to decide whose data it touches — that always comes from the bearer
token. So the funnel holds a phone number only until the code is verified, and after
that reads the person from `GET /v1/me`. Anything that wants to know "whose score is
this?" is asking the wrong question; there is only ever the caller's.

**The quiz is data, and the server owns it.** `POST /v1/quiz/responses` validates both
the answer keys and the answer values against the active definition, and nothing under
`src/` holds a copy of the questions to disagree with it. Everything here takes a
definition as an argument — which is what lets `/api/quiz` run the same validation
against the live one.

**Errors are a code, not a message.** Every failure is `{ error, message, retry_after? }`.
Branch on `error`; the message is for people and gets shown to them where its wording
beats ours.

Two things worth knowing before changing this layer:

- **Refresh tokens rotate**, so the new pair has to be written to a cookie — and a
  server component's render cannot set one. Renders use `readAsUser`, which reports a
  spent token as `stale` rather than refreshing; the browser then posts to
  `/api/session/refresh` and the page re-renders. Route handlers use `callAsUser`,
  which refreshes inline because they can persist the result.
- **Nothing is cached.** Every /v1 response is either a write or answered for whoever
  the bearer token belongs to, the quiz definition included — it is the same bytes for
  everyone but is fetched with an Authorization header, and a cache entry keyed loosely
  enough to be shared would be one visitor's authenticated response served to another.
  The transport has no opt-out.

## Deploying

`https://quiz.imageshield.com` is AWS Amplify app `d6eodb6vvn015` in us-east-1, pointed
at the production API. **Every push to `main` builds and goes live in a few minutes.**
The build is `amplify.yml`.

Env vars live in the Amplify console under Hosting → Environment variables, never in this
repo, since it is public. Amplify hands them to the build only, so a new server-side
variable (one read through `process.env` at runtime) also has to be added to the
`.env.production` line in `amplify.yml`, or the running site never sees it.
`NEXT_PUBLIC_*` values are inlined at build time and need nothing extra. Changing a
variable takes effect on the next deploy; redeploy `main` from the console to apply one
without a push.

## Still open

- Real App Store URL (`.env.example` has a placeholder).
- Universal link / App Links setup so "Open the app" works on an installed device.
  The QR-code handoff from the old design doesn't apply here: nobody scans a QR with
  the phone that's already showing it.
