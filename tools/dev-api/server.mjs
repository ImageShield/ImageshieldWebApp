/**
 * A stand-in for the ImageShield /v1 API, for developing the funnel without it.
 *
 * NOT part of the app and never imported by it — nothing under src/ may reference
 * this directory. It exists so the funnel can be walked end to end without the real
 * API: offline, against a branch, or into the states a real backend will not produce
 * on demand — a score that isn't ready, a write that fails once, an access token about
 * to expire.
 *
 *   npm run dev:api       this alone, on port 5099
 *   npm run dev:offline   this plus `next dev` pointed at it
 *
 * WHAT IT IS FAITHFUL ABOUT, because these are what the funnel's code paths turn on:
 *
 *   - Every failure is the `{ error, message }` envelope, with the codes the real
 *     API uses. Branch on `error`, never on `message`.
 *   - An unknown OTP challenge is 404 NOT_FOUND, not 401. Verified against the live
 *     API, and contradicting the Postman collection, which documents 401.
 *   - Refresh tokens ROTATE. Presenting a spent one is 401.
 *   - `PATCH /v1/me/profile` rejects unknown fields with a 400 rather than ignoring
 *     them, and builds its update from the keys actually present.
 *   - `POST /v1/me/email` is 202 and leaves the address unverified.
 *   - `GET /v1/me/score` 404s with NO_QUIZ_RESPONSE before the quiz. It is the one
 *     read allowed to 404 on emptiness.
 *   - `POST /v1/quiz/responses` validates the version, the answer keys AND the
 *     answer values against the served definition.
 *   - `resend_after` is an ISO instant, not a number of seconds.
 *   - A question may carry `required: false`, and `platforms` does.
 *   - No route accepts an identifier saying whose data to touch. The bearer token
 *     is the only answer to that question.
 *
 * WHAT IT IS NOT: a scorer. The number is a fixed fixture and does not vary with the
 * answers. Nothing about how the funnel renders a score depends on the number being
 * derived, and inventing a second scoring implementation is precisely the mistake the
 * real API's docs warn about. The breakdown DOES carry the account's own answers,
 * because the score screen builds its cards from them — see `scoreFor`.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const config = {
  port: Number(process.env.DEV_API_PORT ?? 5099),
  /** Short-lived on purpose. Set to ~35 to watch the funnel's token rotation run. */
  accessTtl: Number(process.env.DEV_API_ACCESS_TTL ?? 900),
  otpCode: process.env.DEV_API_OTP_CODE ?? "123456",
  score: Number(process.env.DEV_API_SCORE ?? 62),
  /** One of: low risk · moderate risk · high risk · severe risk. */
  band: process.env.DEV_API_BAND ?? "moderate risk",
  /** Answers accepted, number not ready — the `pending` state on the score screen. */
  pendingScore: process.env.DEV_API_PENDING_SCORE === "1",
  /** Fail the first quiz write, to reach the save-failed → resume recovery path. */
  failQuizOnce: process.env.DEV_API_FAIL_QUIZ_ONCE === "1",
  /**
   * `risk_factors` and `general_recommendations`, which the real API doesn't send yet:
   *   unset     leave both out, as prod does today. Both cards hide.
   *   empty     send both as [] — the API saying it has no research; both cards hide.
   *   fixture   send the placeholder rows below, to see both cards with test data.
   */
  insights: process.env.DEV_API_INSIGHTS ?? "absent",
};

/** A real `GET /v1/quiz` response, captured from the live API. Recapture it when the
 *  server edits the quiz. Nothing under src/ mirrors it any more: the screens fetch
 *  the definition, so offline they render whatever this file says. */
const quiz = JSON.parse(readFileSync(join(HERE, "quiz.json"), "utf8"));

/** Per phone number, so two browsers are two accounts rather than one shared record. */
const accounts = new Map();
/** challenge_id → { phone, attempts } */
const challenges = new Map();
/** access token → { phone, expiresAt } */
const access = new Map();
/** refresh token → phone. Deleted on use: rotation means one-time. */
const refresh = new Map();

let quizWriteFailed = false;

const accountFor = (phone) => {
  if (!accounts.has(phone)) {
    accounts.set(phone, {
      person: {
        person_id: `p_${accounts.size + 1}`,
        first_name: null,
        last_name: null,
        email: null,
        email_verified: false,
        date_of_birth: null,
        employer_name: null,
        occupation: null,
        school_name: null,
      },
      answers: null,
    });
  }
  return accounts.get(phone);
};

/** What a field is sent as, if at all — see `config.insights`. */
const insight = (rows) =>
  config.insights === "fixture" ? rows : config.insights === "empty" ? [] : undefined;

const scoreFor = (account) => ({
  live: config.score,
  band: config.band,
  baseline: 70,
  recovered: 0,
  escrow_released: 0,
  dynamic_deduction: 0,
  current_ceiling: 70,
  maximum_ceiling: 100,
  /* The scoring the evidence report pairs with this quiz.json (v17). */
  scoring_version: "likeness-score-v17",
  quiz_version: quiz.quiz_version,
  computed_at: new Date().toISOString(),
  breakdown: {
    /* One entry per answered question, carrying the account's own answer — the score
       screen builds its cards from these. The deductions are placeholders, like the
       number: this is not a scorer. A multi-select answer is echoed as the list it was
       posted as; whether the real API sends a list or a joined string is unconfirmed,
       and the screen reads both. */
    quiz: Object.entries(account.answers ?? {}).map(([key, value]) => ({
      key,
      value,
      deduction: 0,
      type: "fixture",
    })),
    dynamic: [],
    escrow: { next_milestone_days: 90 },
  },
  risk_factors: insight(RISK_FACTORS),
});

/* Placeholder rows in the contract's shape — NOT copy. The real strings are drafted
   from cited research and approved by an operator; nothing here is either, and none
   of it may be lifted into src/. Chosen to reach every branch of the two cards: both
   kinds of factor, and a link labelled, unlabelled and absent. */
const RISK_FACTORS = [
  {
    kind: "quiz",
    key: "age",
    title: "Age",
    line: "Dev fixture line for a quiz factor. The real one comes from the research.",
    points: 9,
  },
  {
    kind: "threat",
    key: "evt_dev_0001",
    title: "Live incident",
    line: "Dev fixture line for a threat: a live incident affecting people who answered like you.",
    points: 6,
  },
  {
    kind: "quiz",
    key: "posting_volume",
    title: "Posting volume",
    line: "Dev fixture line for a second quiz factor.",
    points: 4,
  },
];

const GENERAL_RECOMMENDATIONS = [
  {
    title: "Dev fixture recommendation with a labelled link",
    body: "Placeholder body. The real one is one sentence drafted from a cited source.",
    link: { url: "https://example.org/", label: "Example source" },
  },
  {
    title: "Dev fixture recommendation with an unlabelled link",
    body: "Placeholder body. Its link is named by the page's host instead.",
    link: { url: "https://www.example.com/research", label: null },
  },
  {
    title: "Dev fixture recommendation with no link",
    body: "Placeholder body. No link is drawn under it.",
    link: null,
  },
];

const SCOPE_NOTE =
  "This score covers likeness-protection health in monitored sources. It is not a " +
  "statement about the whole web, and 100 is not an all-clear.";

const mintTokens = (phone) => {
  const at = `at_${Math.random().toString(36).slice(2)}`;
  const rt = `rt_${Math.random().toString(36).slice(2)}`;
  access.set(at, { phone, expiresAt: Date.now() + config.accessTtl * 1000 });
  refresh.set(rt, phone);
  return {
    access_token: at,
    expires_in: config.accessTtl,
    refresh_token: rt,
  };
};

const onboardingFor = (account) => ({
  next_step: account.answers === null ? "quiz" : "plan",
  profile_complete: account.person.first_name !== null,
  quiz_completed: account.answers !== null,
  seat_claimed: false,
  consent_signed: false,
  enrolled: false,
  email_verified: account.person.email_verified,
  photos_uploaded: false,
  notifications_enabled: false,
  skipped_steps: [],
  /* Observed on the live API and absent from the collection. */
  blocking_coverage: ["plan", "consent", "enrolment", "email"],
});

/* ── plumbing ─────────────────────────────────────────────────────────────── */

const send = (res, status, body) => {
  res.statusCode = status;
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const fail = (res, status, error, message, extra = {}) =>
  send(res, status, { error, message, ...extra });

/** The bearer token's phone, or null after answering 401 itself. */
const signedIn = (req, res) => {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const session = access.get(token);
  if (session === undefined) {
    fail(res, 401, "UNAUTHORISED", "authentication required");
    return null;
  }
  if (session.expiresAt < Date.now()) {
    access.delete(token);
    fail(res, 401, "UNAUTHORISED", "the access token has expired");
    return null;
  }
  return session.phone;
};

const E164 = /^\+[1-9]\d{7,14}$/;

const ROUTES = {
  "POST /v1/auth/otp": (req, res, body) => {
    if (typeof body.phone_e164 !== "string" || !E164.test(body.phone_e164)) {
      return fail(res, 400, "VALIDATION_FAILED", "phone_e164: Invalid");
    }
    // Issuing a new challenge consumes any live one for that phone.
    for (const [id, c] of challenges) {
      if (c.phone === body.phone_e164) challenges.delete(id);
    }
    const id = `ch_${Math.random().toString(36).slice(2)}`;
    challenges.set(id, { phone: body.phone_e164, attempts: 0 });
    console.log(`      ↳ code for ${body.phone_e164} is ${config.otpCode}`);
    return send(res, 202, {
      challenge_id: id,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      /* An ISO instant, NOT a count of seconds, whatever the name suggests — that
         is what the live API sends, and a fixture saying otherwise is how the
         funnel came to relay a string into a numeric countdown. */
      resend_after: new Date(Date.now() + 30_000).toISOString(),
    });
  },

  "POST /v1/auth/otp/verify": (req, res, body) => {
    const challenge = challenges.get(body.challenge_id);
    // 404, not 401 — matches the live API, not the collection.
    if (challenge === undefined) {
      return fail(res, 404, "NOT_FOUND", "unknown challenge");
    }
    if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) {
      return fail(res, 400, "VALIDATION_FAILED", "code: must be 6 digits");
    }
    if (body.code !== config.otpCode) {
      challenge.attempts += 1;
      // Attempts are capped; a burned challenge needs a fresh send, so it goes.
      if (challenge.attempts >= 5) challenges.delete(body.challenge_id);
      return fail(res, 401, "UNAUTHORISED", "invalid credentials");
    }
    challenges.delete(body.challenge_id);
    const tokens = mintTokens(challenge.phone);
    return send(res, 200, {
      ...tokens,
      onboarding: onboardingFor(accountFor(challenge.phone)),
    });
  },

  "POST /v1/auth/refresh": (req, res, body) => {
    const phone = refresh.get(body.refresh_token);
    if (phone === undefined) {
      return fail(res, 401, "UNAUTHORISED", "invalid credentials");
    }
    // Rotation: the token just presented is dead from here on.
    refresh.delete(body.refresh_token);
    return send(res, 200, mintTokens(phone));
  },

  /* Answered WITHOUT a session, like the real API. It used to require one, and that
     401 is why this repo once carried its own copy of the questions — the funnel asks
     the quiz before the phone number, so there was no token to read them with. The
     endpoint is public now, so the copy is gone and both ends read this: the screens
     once at the start, `/api/quiz` again at submit.

     The submit-time re-read is still the drift check, and it still reproduces locally
     — but the way to trigger it has changed. Editing quiz.json no longer diverges from
     anything, because nothing local is being compared against; edit it WHILE a tab is
     mid-quiz and that tab's answers meet a definition that has moved, which is the
     real-world case (a deploy mid-funnel) the 409 retake path exists for.

     Built field by field rather than by stripping `_readme`, so what the fixture
     serves is exactly the two keys the contract has and nothing that happens to be
     sitting in the JSON alongside them. */
  "GET /v1/quiz": (req, res) =>
    send(res, 200, {
      quiz_version: quiz.quiz_version,
      questions: quiz.questions,
    }),

  "GET /v1/me": (req, res, body, phone) => {
    const account = accountFor(phone);
    return send(res, 200, {
      account: { phone_e164: phone, status: "active" },
      person: account.person,
      consent_eligibility: { required_signer_role: "self", blocked_reason: null },
      onboarding: onboardingFor(account),
      household: null,
      score:
        account.answers === null
          ? null
          : { total_score: config.score, band: config.band, computed_at: new Date().toISOString() },
    });
  },

  "PATCH /v1/me/profile": (req, res, body, phone) => {
    const allowed = [
      "first_name",
      "last_name",
      "date_of_birth",
      "employer_name",
      "occupation",
      "school_name",
    ];
    const unknown = Object.keys(body).filter((k) => !allowed.includes(k));
    if (unknown.length > 0) {
      return fail(res, 400, "VALIDATION_FAILED", `unknown field: ${unknown[0]}`);
    }
    const account = accountFor(phone);
    Object.assign(account.person, body);
    return send(res, 200, account.person);
  },

  "POST /v1/me/email": (req, res, body, phone) => {
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return fail(res, 400, "VALIDATION_FAILED", "email: Invalid");
    }
    const account = accountFor(phone);
    account.person.email = body.email;
    // Recorded, and NOT verified until the link is opened.
    account.person.email_verified = false;
    console.log(`      ↳ verification email would be sent to ${body.email}`);
    return send(res, 202);
  },

  "POST /v1/quiz/responses": (req, res, body, phone) => {
    if (config.failQuizOnce && !quizWriteFailed) {
      quizWriteFailed = true;
      return fail(res, 503, "UPSTREAM_UNAVAILABLE", "the scoring service is briefly unavailable");
    }
    if (body.quiz_version !== quiz.quiz_version) {
      return fail(res, 400, "VALIDATION_FAILED", "quiz_version is not the active definition");
    }
    for (const [key, value] of Object.entries(body.answers ?? {})) {
      const question = quiz.questions.find((q) => q.key === key);
      if (question === undefined) {
        return fail(res, 400, "VALIDATION_FAILED", `unknown question: ${key}`);
      }
      const picked = Array.isArray(value) ? value : [value];
      for (const one of picked) {
        if (!question.options.includes(one)) {
          return fail(res, 400, "VALIDATION_FAILED", `${key}: ${one} is not an option`);
        }
      }
    }
    const account = accountFor(phone);
    account.answers = body.answers;
    return send(res, 201, {
      score: config.pendingScore ? null : scoreFor(account),
      scope_note: SCOPE_NOTE,
      general_recommendations: insight(GENERAL_RECOMMENDATIONS),
    });
  },

  "GET /v1/me/score": (req, res, body, phone) => {
    const account = accountFor(phone);
    if (account.answers === null) {
      return fail(res, 404, "NO_QUIZ_RESPONSE", "no quiz response yet");
    }
    return send(res, 200, {
      score: config.pendingScore ? null : scoreFor(account),
      scope_note: SCOPE_NOTE,
      general_recommendations: insight(GENERAL_RECOMMENDATIONS),
    });
  },
};

/** Routes answered without a session: the three that are how one begins, and the quiz
 *  definition, which is the same bytes for everyone and carries nothing about anybody.
 *  Everything else needs a bearer token. */
const ANONYMOUS = new Set([
  "POST /v1/auth/otp",
  "POST /v1/auth/otp/verify",
  "POST /v1/auth/refresh",
  "GET /v1/quiz",
]);

createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const path = req.url.split("?")[0];
    const route = `${req.method} ${path}`;

    let body = {};
    if (raw !== "") {
      try {
        body = JSON.parse(raw);
      } catch {
        return fail(res, 400, "VALIDATION_FAILED", "body is not JSON");
      }
    }

    res.on("finish", () => console.log(`  ${String(res.statusCode)}  ${route}`));

    const handler = ROUTES[route];
    if (handler === undefined) {
      return fail(res, 404, "NOT_FOUND", `no route for ${route}`);
    }

    if (ANONYMOUS.has(route)) return handler(req, res, body);

    const phone = signedIn(req, res);
    if (phone === null) return;
    return handler(req, res, body, phone);
  });
}).listen(config.port, () => {
  console.log(
    [
      "",
      "  ImageShield /v1 — DEVELOPMENT FIXTURE, not the API",
      `  http://localhost:${String(config.port)}`,
      "",
      `  OTP code        ${config.otpCode} (any other 6 digits is rejected)`,
      `  quiz            ${quiz.quiz_version}, ${String(quiz.questions.length)} questions, INVENTED keys`,
      `  score           ${String(config.score)} · ${config.band}`,
      `  access token    ${String(config.accessTtl)}s`,
      config.pendingScore ? "  pending score   on — the score screen shows 'being worked out'" : null,
      config.failQuizOnce ? "  fail-quiz-once  on — the first quiz write 503s" : null,
      "",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  );
});
