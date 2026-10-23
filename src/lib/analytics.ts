"use client";

import { ANSWER_ANALYTICS_APPROVED } from "./analytics-approval";
import { type MappedQuestion, QUIZ_ANALYTICS_MAP } from "./analytics-quiz-map";
import { readConsent } from "./consent";
import { readFunnel } from "./funnel-state";
import { saidUnder18 } from "./not-eligible";
import {
  missingAnswers,
  type QuizDefinition,
  type QuizQuestion,
  recognisesMinors,
} from "./quiz";

/**
 * Quiz funnel events for Tag Manager, pushed from the code rather than scraped off the
 * page.
 *
 * GTM can't see inside a client-rendered quiz — no page loads between questions, and
 * click triggers keyed on classes or button text break with the next redesign. So the
 * quiz pushes named events, and the container listens with Custom Event triggers:
 *
 *   quiz_start     the first question a visitor reaches     quiz_version, question_number
 *   quiz_answer    an answer committed                      quiz_version, question,
 *                                                           question_number, answer?
 *   quiz_complete  the last question answered               quiz_version, question_count
 *
 * Abandonment is read from these, not sent: someone who answered question N and never
 * N+1 stopped at N+1. A page-close event would miss most phones and fire on every
 * normal exit.
 *
 * `answer` is sent only when ANSWER_ANALYTICS_APPROVED is on and the question is
 * approved in QUIZ_ANALYTICS_MAP for this exact quiz version. Nothing that identifies
 * the visitor is ever sent, and nothing is logged.
 *
 * Rename an event or field only together with the container: a trigger or variable
 * listening for a name nobody pushes fails silently.
 */
export type AnalyticsEvent =
  | { event: "quiz_start"; quiz_version: string; question_number: number }
  | {
      event: "quiz_answer";
      quiz_version: string;
      question: string;
      question_number: number;
      /** Only for an approved question — see `answerAllowed`. */
      answer?: string;
    }
  | { event: "quiz_complete"; quiz_version: string; question_count: number };

export type AnalyticsEventName = AnalyticsEvent["event"];

const EVENT_NAMES: ReadonlySet<string> = new Set<AnalyticsEventName>([
  "quiz_start",
  "quiz_answer",
  "quiz_complete",
]);

/* Bounds for every value that travels, so a wrong argument is dropped rather than
   sent. A quiz version is a slug like `likeness-health-v11`. GA4 keeps 100 characters
   of a parameter value; an answer longer than that is dropped, never cut, so a
   truncated value can't pass for a real option. */
const MAX_QUESTION_NUMBER = 50;
const QUIZ_VERSION = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
/* Backend keys have been snake_case (`prior_misuse`), generated (`q_il8uju`) and
   camelCase (`pastExploitation`, v1); an unreviewed version's key is reported as is. */
const QUESTION_ID = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_ANSWER_LENGTH = 100;
/** Joins a multi-select's options. None of the reviewed options contain it. */
export const ANSWER_SEPARATOR = "|";

/**
 * Never sent, whatever the map says: an age band, a gender identity and a history of
 * image abuse. The banner's drafted wording promises exactly this, so it is a rule in
 * code rather than a value in a table someone might copy wrong.
 */
const NEVER_FORWARDED: ReadonlySet<string> = new Set(["age", "gender", "prior_misuse"]);

const mapFor = (version: string) =>
  Object.hasOwn(QUIZ_ANALYTICS_MAP, version) ? QUIZ_ANALYTICS_MAP[version] : undefined;

type Payload = Record<string, string | number | undefined>;

/**
 * Every field of the schema, cleared. GTM's data model keeps the last value pushed
 * for each key, so a field an event doesn't set would otherwise still read as the
 * previous event's: `gender` would be reported with the `platforms` answer before it.
 * Pushing it as undefined is how GTM is told to forget it.
 */
const CLEARED: Payload = {
  quiz_version: undefined,
  question: undefined,
  question_number: undefined,
  answer: undefined,
  question_count: undefined,
};

const validNumber = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_QUESTION_NUMBER;

/** Whether this exact value may be reported for this question of this version. */
function answerAllowed(version: string, id: string, answer: string): boolean {
  if (!ANSWER_ANALYTICS_APPROVED || NEVER_FORWARDED.has(id)) return false;
  if (answer.length === 0 || answer.length > MAX_ANSWER_LENGTH) return false;
  const mapped = mapFor(version)?.find((q) => q.id === id);
  if (!mapped?.forwardAnswer || NEVER_FORWARDED.has(mapped.key)) return false;
  const values = mapped.multi ? answer.split(ANSWER_SEPARATOR) : [answer];
  /* Defined options only, each once, in the quiz's own order — the one encoding. */
  const canonical = mapped.options.filter((option) => values.includes(option));
  return canonical.length === values.length && canonical.join(ANSWER_SEPARATOR) === answer;
}

/**
 * The object pushed, built field by field — never by spreading the argument, so a
 * field a caller slipped past the type can't ride along. Null for an unknown name or a
 * payload out of bounds.
 */
function payloadOf(e: AnalyticsEvent): Payload | null {
  if (!EVENT_NAMES.has(e.event)) return null;
  if (typeof e.quiz_version !== "string" || !QUIZ_VERSION.test(e.quiz_version)) return null;
  const base: Payload = { event: e.event, ...CLEARED, quiz_version: e.quiz_version };

  switch (e.event) {
    case "quiz_start":
      return validNumber(e.question_number) ? { ...base, question_number: e.question_number } : null;
    case "quiz_complete":
      return validNumber(e.question_count) ? { ...base, question_count: e.question_count } : null;
    case "quiz_answer": {
      if (typeof e.question !== "string" || !QUESTION_ID.test(e.question)) return null;
      if (!validNumber(e.question_number)) return null;
      const payload: Payload = { ...base, question: e.question, question_number: e.question_number };
      /* Checked here as well as in `trackAnswer`, so a direct `track` call can't
         attach an answer that the reviewed map doesn't allow. */
      if (typeof e.answer === "string" && answerAllowed(e.quiz_version, e.question, e.answer)) {
        payload.answer = e.answer;
      }
      return payload;
    }
  }
}

/**
 * Each event counts once per tab and quiz version: the funnel's own state lives in
 * sessionStorage for the same span. Without this, a reload, stepping back and
 * re-answering, or React running an effect twice would each count again. A changed
 * answer to a question already reported is not sent again — the first committed
 * answer is the one counted. A retake against a new quiz version is a new quiz.
 */
const SENT_KEY = "imageshield.analytics.v1";
/* Holds what sessionStorage couldn't (private mode, quota), for this page's life. */
const sentInMemory = new Set<string>();

function dedupeKey(e: AnalyticsEvent): string {
  return e.event === "quiz_answer"
    ? `${e.event}:${e.quiz_version}:${e.question}`
    : `${e.event}:${e.quiz_version}`;
}

function readSent(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(SENT_KEY);
    return new Set([...sentInMemory, ...(raw ? (JSON.parse(raw) as string[]) : [])]);
  } catch {
    return sentInMemory;
  }
}

function markSent(sent: Set<string>, key: string): void {
  sent.add(key);
  try {
    window.sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
  } catch {
    sentInMemory.add(key);
  }
}

/**
 * Pushes a funnel event, or drops it. Every rule lives here so no screen repeats one:
 *
 *   Consent. Read from the consent cookie at the moment of the push, so a withdrawal
 *   stops events at once rather than at the reload that follows it.
 *
 *   The container's own `dataLayer`. TrackingScripts creates it only once analytics
 *   is granted. Dropped, never queued, when it isn't there: creating the array here
 *   would hold events until GTM loaded and replay them ahead of the consent defaults,
 *   so a visitor who accepted halfway would be reported for steps taken before.
 *
 *   Under-18s. Someone who says they are under 18 is turned away and nothing of
 *   theirs is kept, so nothing about them goes to Google either. That includes the
 *   age answer itself: it is checked after the store has it.
 */
export function track(e: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  if (readConsent()?.analytics !== true) return;
  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  if (!Array.isArray(dataLayer)) return;
  if (saidUnder18()) return;

  const payload = payloadOf(e);
  if (!payload) return;

  const key = dedupeKey(e);
  const sent = readSent();
  if (sent.has(key)) return;
  markSent(sent, key);
  dataLayer.push(payload);
  /* And cleared again straight away. The reset at the start of the next quiz event
     only helps quiz events: in between, GTM's model would still hold this answer for
     any other tag that read it — a page view on the navigation that follows, say. A
     push with no `event` changes the model and fires nothing. */
  dataLayer.push({ ...CLEARED });
}

/** The questions everyone is asked: gated ones are only asked after particular answers. */
const ungated = (definition: QuizDefinition) => definition.questions.filter((q) => !q.requires);

/**
 * The number a question is reported under: its place among the questions everyone
 * is asked. A gated question is left out entirely, and the numbering skips it —
 * reporting it, or letting it shift the numbers after it, would tell the container
 * which answers opened it. (No live version gates a question.)
 */
export function reportedQuestionNumber(definition: QuizDefinition, key: string): number | null {
  const index = ungated(definition).findIndex((q) => q.key === key);
  return index < 0 ? null : index + 1;
}

/**
 * This question's reviewed entry, if the live definition still matches it exactly.
 * Anything else — an unknown version, a question added, reworded, reordered or given
 * different options — has no entry, and reports its backend key with no answer.
 */
function reviewed(definition: QuizDefinition, question: QuizQuestion): MappedQuestion | undefined {
  const mapped = mapFor(definition.quiz_version)?.find((q) => q.key === question.key);
  if (!mapped) return undefined;
  const same =
    mapped.position === definition.questions.indexOf(question) + 1 &&
    mapped.prompt === question.prompt &&
    mapped.multi === Boolean(question.multi) &&
    mapped.options.length === question.options.length &&
    mapped.options.every((option, i) => option === question.options[i]);
  return same ? mapped : undefined;
}

/**
 * The committed answer, encoded for the dataLayer: the option itself, or a
 * multi-select's options joined with `|` in the definition's order — so the same
 * picks always read the same, whatever order they were ticked in. Read from the store,
 * which already holds the answer when this runs. Only options the definition lists.
 */
function encodedAnswer(question: QuizQuestion): string | undefined {
  const given = readFunnel().answers[question.key];
  const picked = new Set(Array.isArray(given) ? given : given ? [given] : []);
  const values = question.options.filter((option) => picked.has(option));
  if (values.length === 0 || values.some((v) => v.includes(ANSWER_SEPARATOR))) return undefined;
  return values.join(ANSWER_SEPARATOR);
}

/**
 * Runs a quiz helper so that analytics can never break the quiz — these are called from
 * the answer handlers, before the navigation — and so that nothing is sent at all for a
 * definition whose age question no longer recognises an under-18 answer.
 */
function guarded(definition: QuizDefinition, run: () => void): void {
  try {
    if (!recognisesMinors(definition)) return;
    run();
  } catch {
    // Dropped: a missing event is better than a quiz that won't move on.
  }
}

/** `quiz_start`, for the first question a visitor is shown — wherever they came in. */
export function trackStart(definition: QuizDefinition, key: string): void {
  guarded(definition, () => {
    const n = reportedQuestionNumber(definition, key);
    if (n === null) return;
    track({ event: "quiz_start", quiz_version: definition.quiz_version, question_number: n });
  });
}

/** `quiz_answer` for the question with this key, once its answer is in the store. */
export function trackAnswer(definition: QuizDefinition, key: string): void {
  guarded(definition, () => answerEvent(definition, key));
}

function answerEvent(definition: QuizDefinition, key: string): void {
  const question = definition.questions.find((q) => q.key === key);
  const n = reportedQuestionNumber(definition, key);
  if (!question || n === null) return;
  /* Start comes first, always. A visitor who accepts analytics while on a question has
     already had that screen's start dropped, so without this their first answer would
     reach the container before any start. A no-op once a start has been sent. */
  trackStart(definition, key);
  const mapped = reviewed(definition, question);
  const answer = mapped?.forwardAnswer ? encodedAnswer(question) : undefined;
  track({
    event: "quiz_answer",
    quiz_version: definition.quiz_version,
    question: mapped?.id ?? key,
    question_number: n,
    ...(answer === undefined ? {} : { answer }),
  });
}

/**
 * `quiz_complete`, with the number of questions reported — only when every question
 * has an answer. A link straight to the last question can reach `finish()` with the
 * rest unanswered; counting that as a completion would also use up the one completion
 * this tab can send, so the real one later would be lost.
 */
export function trackComplete(definition: QuizDefinition): void {
  guarded(definition, () => {
    if (missingAnswers(definition, readFunnel().answers).length > 0) return;
    const asked = ungated(definition);
    /* Start first, as for an answer: it can't have gone yet if consent was given on
       the last question, and that question's answer would have sent it — unless it
       is a gated question, which sends nothing. */
    if (asked.length > 0) trackStart(definition, asked[asked.length - 1].key);
    track({
      event: "quiz_complete",
      quiz_version: definition.quiz_version,
      question_count: asked.length,
    });
  });
}
