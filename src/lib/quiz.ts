/**
 * The shape of a quiz, and the rules for handling answers to one.
 *
 * Not the questions themselves — those come from `GET /v1/quiz`, read without a
 * session for the screens and with one at submit. This file is what both ends agree on.
 *
 * Everything here takes the definition as an argument rather than reaching for one,
 * and that is deliberate: `/api/quiz` runs these same functions against a definition
 * it re-read itself, while the screens run them against the one they rendered from.
 * Those are normally the same bytes, and when a deploy lands mid-funnel they are not —
 * which is exactly how the mismatch gets caught instead of becoming a 400.
 *
 * Client-safe on purpose — the screens import it directly.
 */

export type QuizQuestion = {
  /** The answer key. `answers` is an object keyed by these. */
  key: string;
  prompt: string;
  options: readonly string[];
  /** Multi-select: the answer is an array of options rather than one. */
  multi?: boolean;
  /** False for a question that is asked but doesn't move the score. */
  scored?: boolean;
  /** False for a question the visitor may leave blank. Absent means required —
   *  the live definition only sets it on `platforms`, and only to false. */
  required?: boolean;
  /**
   * The definition's conditional unlock, in either spelling the server serves:
   *
   *   v1  { key: 'pastExploitation', value: 'Yes' }                 one trigger
   *   v3  { key: 'prior_misuse', values: ['Once or twice', ...] }   several
   *
   * Both value keys are optional and either may be the one present, which is the
   * whole of the defect this shape has caused twice. Read it through `applies`,
   * never directly — see the note there.
   */
  requires?: { key: string; value?: string; values?: readonly string[] };
};

export type QuizDefinition = {
  /** Pins answers to the definition they were answered against. Never invented. */
  quiz_version: string;
  questions: readonly QuizQuestion[];
};

export type QuizAnswers = Record<string, string | string[]>;

/** The API's own caps on an answer. Checked here so the copy is ours, not a 400. */
const MAX_VALUE_LENGTH = 200;
const MAX_SELECTIONS = 50;

/**
 * Does this question apply, given the answers so far?
 *
 * The server's own predicate, and the ONLY place `requires` is read. Both spellings
 * are honoured — plural first, then the v1 singular — because the history of getting
 * this wrong runs in both directions and each way shipped:
 *
 *   Reading only `value` found `undefined` on every v3 gate, so `discovery_method`
 *   was unreachable by any answer — a six-question quiz that silently asked five.
 *
 *   Answering that by dropping the gate entirely asked "How did you find out about
 *   the abuse?" of visitors who had just answered "No known incidents", and sent that
 *   context on submissions where the gate was shut.
 *
 * One copy, called from one place. Two that disagreed with the server is how the
 * original defect shipped unnoticed.
 */
export function applies(question: QuizQuestion, answers: QuizAnswers): boolean {
  const gate = question.requires;
  if (!gate) return true;

  /* An `accepted` that comes out empty means the gate names no trigger at all, and
     nothing can satisfy it — the question stays shut rather than falling open. */
  const accepted = gate.values ?? (gate.value ? [gate.value] : []);
  const trigger = answers[gate.key];

  if (typeof trigger === "string") return accepted.includes(trigger);
  /* A multi-select gate opens on any one of its selections. */
  if (Array.isArray(trigger)) return trigger.some((v) => accepted.includes(v));
  /* Unanswered: shut, not open. */
  return false;
}

/**
 * The questions being asked, in the order the definition lists them.
 *
 * Filtered by the gate, never sorted — the served order is the contract. The length
 * MOVES with the answers: it is 5 until `prior_misuse` is answered with a trigger and
 * 6 after, so nothing may cache it across an answer.
 *
 * Still a function rather than `definition.questions` inlined at the call sites, and
 * the reason is the step count. Three places count these — the `(3/6)` label, "is this
 * the last question", and whether stored answers cover the quiz — and they have to
 * agree with each other and with what `/api/quiz` validates.
 */
export function askedQuestions(
  definition: QuizDefinition,
  answers: QuizAnswers,
): QuizQuestion[] {
  return definition.questions.filter((q) => applies(q, answers));
}

/** Questions still unanswered — drives the Continue button and the server check. */
export function missingAnswers(
  definition: QuizDefinition,
  answers: QuizAnswers,
): string[] {
  return askedQuestions(definition, answers)
    .filter((q) => {
      /* `required: false` is the server saying this one may be skipped, and the
         live `platforms` question carries it. Treating every asked question as
         mandatory held Continue disabled on a question the API would have
         accepted empty — a dead end with nothing on screen explaining it. */
      if (q.required === false) return false;
      const given = answers[q.key];
      return q.multi
        ? !Array.isArray(given) || given.length === 0
        : typeof given !== "string" || given === "";
    })
    .map((q) => q.key);
}

/**
 * Sanitise answers before they reach the API.
 *
 * The API validates them too, and would be within its rights to be the only thing
 * that does. This runs anyway because of where `/api/quiz` runs it — against the live
 * definition, before the write — which is what turns a drifted local quiz from a bare
 * "400 VALIDATION_FAILED" into a sentence naming the question and a screen that sends
 * the visitor back to answer it.
 *
 * Unknown keys are dropped rather than forwarded, off-menu values are refused.
 */
export function validateAnswers(
  definition: QuizDefinition,
  raw: unknown,
): { ok: true; answers: QuizAnswers } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "answers must be an object" };
  }
  const input = raw as Record<string, unknown>;
  const answers: QuizAnswers = {};

  for (const question of definition.questions) {
    const given = input[question.key];
    if (given === undefined || given === null) continue;

    if (question.multi) {
      if (!Array.isArray(given)) {
        return { ok: false, error: `${question.key} must be a list` };
      }
      if (given.length > MAX_SELECTIONS) {
        return { ok: false, error: `${question.key} has too many selections` };
      }
      const picked = given.filter(
        (v): v is string =>
          typeof v === "string" && question.options.includes(v),
      );
      if (picked.length !== given.length) {
        return { ok: false, error: `${question.key} has an unknown option` };
      }
      if (picked.length > 0) answers[question.key] = picked;
      continue;
    }

    if (
      typeof given !== "string" ||
      given.length > MAX_VALUE_LENGTH ||
      !question.options.includes(given)
    ) {
      return { ok: false, error: `${question.key} has an unknown option` };
    }
    answers[question.key] = given;
  }

  /* Second pass: drop answers to questions the gate has since SHUT.
     Going back and changing `prior_misuse` from "Repeated pattern" to "No known
     incidents" hides `discovery_method`, but its answer outlives the question in
     sessionStorage — and sending it would be answering a question that was not
     asked. Evaluated against the validated set above, so the gating answer is the
     one the API is about to be given.

     The loop above already builds `answers` from the definition's own keys, so a
     key the server does not serve cannot reach the write regardless of this. */
  const askedKeys = new Set(askedQuestions(definition, answers).map((q) => q.key));
  for (const key of Object.keys(answers)) {
    if (!askedKeys.has(key)) delete answers[key];
  }

  const missing = missingAnswers(definition, answers);
  if (missing.length > 0) {
    return { ok: false, error: `unanswered: ${missing.join(", ")}` };
  }

  return { ok: true, answers };
}

/**
 * Whether a visitor still has quiz left to do — the guard every screen after the
 * quiz runs before it lets someone stand on it. The details form is the first of
 * them, which is what stops anyone spending a code on a score they never earned.
 *
 * A version mismatch counts as incomplete, and that is the part worth spelling out:
 * answers stored against a version this tab no longer renders are complete answers to
 * questions that are no longer being asked. Treating them as done would carry them all
 * the way to `POST /v1/quiz/responses`, which rejects them.
 */
export function quizIncomplete(
  definition: QuizDefinition,
  state: { answers: QuizAnswers; quizVersion?: string },
): boolean {
  if (state.quizVersion !== definition.quiz_version) return true;
  return missingAnswers(definition, state.answers).length > 0;
}

/**
 * The age question's under-18 answers.
 *
 * The funnel is adults-only — the details form asks for an 18+ confirmation, and the
 * profile is given an adult placeholder birth date on the strength of it — but the
 * age question still offers an under-18 option, because the backend owns the
 * questions. So it is the screens that turn it away, before a code is sent or
 * anything is written.
 *
 * "Under 18" is the live spelling: `GET /v1/quiz` serves it on both prod (v11) and
 * dev (v15), checked 2026-10-05. "13-17" is the older band the local dev fixture
 * (tools/dev-api/quiz.json, v2) still serves, kept so the fixture exercises the same
 * path. Matched exactly, because options are display strings the API validates
 * verbatim — which cuts both ways: if the backend rewords the option again, this
 * stops matching and has to be changed with it.
 */
const AGE_QUESTION_KEY = "age";
const MINOR_AGE_ANSWERS: ReadonlySet<string> = new Set(["Under 18", "13-17"]);

/** Whether the visitor answered the age question with an under-18 option. */
export function declaresMinor(answers: QuizAnswers): boolean {
  const age = answers[AGE_QUESTION_KEY];
  return typeof age === "string" && MINOR_AGE_ANSWERS.has(age);
}
