import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AnalyticsEvent,
  reportedQuestionNumber,
  track,
  trackAnswer,
  trackComplete,
  trackStart,
} from "./analytics";
import { definitionOf } from "./analytics.fixtures";
import { QUIZ_ANALYTICS_MAP } from "./analytics-quiz-map";
import { writeConsent } from "./consent";
import { writeFunnel } from "./funnel-state";
import type { QuizDefinition } from "./quiz";

/* The switch held off explicitly, so these keep testing the unapproved behaviour after
   it is turned on. The approved behaviour is in analytics.approved.test.ts. */
vi.mock("./analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: false }));

/* The events only: each is followed by an event-less reset push, tested on its own. */
const raw = () =>
  (window as Window & { dataLayer?: Record<string, unknown>[] }).dataLayer?.filter(
    (e) => "event" in e,
  );
/* The pushes with their cleared (undefined) fields left out, as JSON would. */
const dataLayer = () => {
  const pushed = raw();
  return pushed && (JSON.parse(JSON.stringify(pushed)) as unknown[]);
};

const grant = () => writeConsent({ analytics: true, marketing: false });
/* What TrackingScripts' inline snippet does once analytics is granted. */
const loadContainer = () => vi.stubGlobal("dataLayer", []);

const V = "likeness-health-v11";
const ANSWER: AnalyticsEvent = { event: "quiz_answer", quiz_version: V, question: "age", question_number: 1 };
const START: AnalyticsEvent = { event: "quiz_start", quiz_version: V, question_number: 1 };
const COMPLETE: AnalyticsEvent = { event: "quiz_complete", quiz_version: V, question_count: 6 };

const V11_ANSWERS = {
  age: "25-34",
  gender: "Non-Binary",
  platforms: ["TikTok", "X (Twitter)", "Instagram"],
  posting_volume: "Weekly",
  prior_misuse: "Once or twice",
  discovery_method: "I subscribe to a likeness detection/monitoring service",
};

beforeEach(() => {
  document.cookie = "imageshield_consent=; Max-Age=0; Path=/";
  window.sessionStorage.clear();
  writeFunnel({ quizVersion: V, answers: { age: "25-34" } });
});

afterEach(() => vi.unstubAllGlobals());

describe("track", () => {
  describe("payloads", () => {
    beforeEach(() => {
      grant();
      loadContainer();
    });

    it("pushes quiz_start with the version and the position reached", () => {
      track(START);
      expect(dataLayer()).toStrictEqual([START]);
    });

    it("pushes quiz_answer with version, question and position", () => {
      track(ANSWER);
      expect(dataLayer()).toStrictEqual([ANSWER]);
    });

    it("pushes quiz_complete with the version and question count", () => {
      track(COMPLETE);
      expect(dataLayer()).toStrictEqual([COMPLETE]);
    });

    /* Fields a caller forces past the type are not copied: the payload is built field
       by field, not spread from the argument. */
    it("never forwards a field outside the schema", () => {
      track({
        ...ANSWER,
        question: "prior_misuse",
        email: "ada@example.com",
        phone: "+447700900123",
        otp: "123456",
        score: 41,
        band: "high risk",
      } as AnalyticsEvent);
      track({ ...COMPLETE, firstName: "Ada", answers: V11_ANSWERS } as AnalyticsEvent);
      expect(dataLayer()).toStrictEqual([{ ...ANSWER, question: "prior_misuse" }, COMPLETE]);
    });

    it("sends no answer while answer analytics is not approved, even one it would allow", () => {
      track({ ...ANSWER, question: "platforms", question_number: 3, answer: "Instagram" });
      expect(dataLayer()).toStrictEqual([{ ...ANSWER, question: "platforms", question_number: 3 }]);
    });

    it("drops an event name outside the schema", () => {
      track({ event: "score_viewed", quiz_version: V } as unknown as AnalyticsEvent);
      track({ event: "gtm.js", quiz_version: V } as unknown as AnalyticsEvent);
      expect(dataLayer()).toStrictEqual([]);
    });

    it.each(["", "Prior Misuse", "prior-misuse", "x".repeat(41)])(
      "drops a quiz_answer whose question is %j",
      (question) => {
        track({ ...ANSWER, question });
        expect(dataLayer()).toStrictEqual([]);
      },
    );

    it.each([0, -1, 1.5, Number.NaN, 51])("drops events numbered %s", (n) => {
      track({ ...ANSWER, question_number: n });
      track({ ...START, question_number: n });
      track({ ...COMPLETE, question_count: n });
      expect(dataLayer()).toStrictEqual([]);
    });

    it("drops any event whose version isn't a slug", () => {
      track({ ...ANSWER, quiz_version: "Female  " });
      track({ ...START, quiz_version: "" });
      track({ ...COMPLETE, quiz_version: "a b" });
      expect(dataLayer()).toStrictEqual([]);
    });

    /* Between quiz events GTM's model would otherwise still hold the last answer for
       any other tag — a page view on the navigation that follows, say. */
    it("clears every field again straight after each event", () => {
      track(ANSWER);
      const all = (window as Window & { dataLayer?: Record<string, unknown>[] }).dataLayer ?? [];
      expect(all).toHaveLength(2);
      expect("event" in all[1]).toBe(false);
      for (const key of ["quiz_version", "question", "question_number", "answer", "question_count"]) {
        expect(Object.hasOwn(all[1], key) && all[1][key] === undefined).toBe(true);
      }
    });

    /* GTM keeps the last value of every key; a field left out would carry over. */
    it("clears every field an event doesn't carry", () => {
      track(ANSWER);
      track(COMPLETE);
      const [answer, complete] = raw() ?? [];
      for (const key of ["answer", "question_count"]) {
        expect(Object.hasOwn(answer, key) && answer[key] === undefined).toBe(true);
      }
      for (const key of ["question", "question_number", "answer"]) {
        expect(Object.hasOwn(complete, key) && complete[key] === undefined).toBe(true);
      }
    });
  });

  describe("consent", () => {
    it("sends nothing, and creates no dataLayer, before the visitor has chosen", () => {
      track(START);
      expect(dataLayer()).toBeUndefined();
    });

    it("sends nothing when analytics is rejected, even if a dataLayer exists", () => {
      writeConsent({ analytics: false, marketing: true });
      loadContainer();
      track(START);
      track(ANSWER);
      expect(dataLayer()).toStrictEqual([]);
    });

    /* Granted, but the container's snippet hasn't run yet. Queuing here is what
       would backfill: GTM replays whatever is already in the array when it loads. */
    it("drops rather than queues an event pushed before the container loads", () => {
      grant();
      track(START);
      expect(dataLayer()).toBeUndefined();
    });

    /* Found in a browser walk: accepting while on question 3 put that question's
       answer ahead of any start. */
    it("sends the start before the first answer after a mid-question grant", () => {
      const v11 = definitionOf(V);
      trackStart(v11, "platforms");
      grant();
      loadContainer();
      trackAnswer(v11, "platforms");
      trackStart(v11, "posting_volume");
      trackAnswer(v11, "posting_volume");
      expect(dataLayer()).toStrictEqual([
        { ...START, question_number: 3 },
        { ...ANSWER, question: "platforms", question_number: 3 },
        { ...ANSWER, question: "posting_volume", question_number: 4 },
      ]);
    });

    it("tracks from the moment of a mid-quiz grant, without backfilling", () => {
      track(START);
      track(ANSWER);
      grant();
      loadContainer();
      track({ ...ANSWER, question: "gender", question_number: 2 });
      expect(dataLayer()).toStrictEqual([{ ...ANSWER, question: "gender", question_number: 2 }]);
    });

    /* The reload that follows a withdrawal comes after the cookie is written; nothing
       may slip out in between. */
    it("stops at once when analytics is withdrawn", () => {
      grant();
      loadContainer();
      track(START);
      writeConsent({ analytics: false, marketing: false });
      track(ANSWER);
      track(COMPLETE);
      expect(dataLayer()).toStrictEqual([START]);
    });
  });

  describe("duplicates and order", () => {
    beforeEach(() => {
      grant();
      loadContainer();
    });

    it("sends each event once per tab, in the order pushed", () => {
      for (let i = 0; i < 2; i++) {
        track(START);
        track(ANSWER);
        track({ ...ANSWER, question: "gender", question_number: 2 });
        track(COMPLETE);
      }
      expect(dataLayer()).toStrictEqual([
        START,
        ANSWER,
        { ...ANSWER, question: "gender", question_number: 2 },
        COMPLETE,
      ]);
    });

    it("remembers what was sent across a reload of the tab", async () => {
      track(COMPLETE);
      vi.resetModules();
      const fresh = await import("./analytics");
      fresh.track(COMPLETE);
      expect(dataLayer()).toStrictEqual([COMPLETE]);
    });

    /* A retake after a deploy is answering a different quiz. */
    it("counts start, answers and completion again under a new quiz version", () => {
      const v12 = "likeness-health-v12";
      for (const e of [START, ANSWER, COMPLETE]) {
        track(e);
        track({ ...e, quiz_version: v12 });
      }
      expect(dataLayer()).toHaveLength(6);
    });
  });

  describe("under-18s", () => {
    beforeEach(() => {
      grant();
      loadContainer();
    });

    /* Their answers were wiped (a new quiz version) and now read as an adult's. */
    it("sends nothing in a tab that said under 18 earlier", () => {
      window.sessionStorage.setItem("imageshield.under18", "1");
      writeFunnel({ quizVersion: V, answers: { age: "25-34" } });
      track(START);
      track(ANSWER);
      track(COMPLETE);
      expect(dataLayer()).toStrictEqual([]);
    });

    it("sends nothing once the visitor has said they are under 18", () => {
      writeFunnel({ quizVersion: V, answers: { age: "Under 18" } });
      track(ANSWER);
      track(COMPLETE);
      track({ ...START, question_number: 2 });
      expect(dataLayer()).toStrictEqual([]);
    });
  });
});

describe("the quiz helpers", () => {
  beforeEach(() => {
    grant();
    loadContainer();
    writeFunnel({ quizVersion: V, answers: V11_ANSWERS });
  });

  it("reports every v11 question by its reviewed id, with no answers while unapproved", () => {
    const v11 = definitionOf(V);
    trackStart(v11, "age");
    for (const q of v11.questions) trackAnswer(v11, q.key);
    trackComplete(v11);
    expect(dataLayer()).toStrictEqual([
      START,
      { ...ANSWER, question: "age", question_number: 1 },
      { ...ANSWER, question: "gender", question_number: 2 },
      { ...ANSWER, question: "platforms", question_number: 3 },
      { ...ANSWER, question: "posting_volume", question_number: 4 },
      { ...ANSWER, question: "prior_misuse", question_number: 5 },
      /* `discovery_method` on v11, `q_il8uju` on v17: one name in the reports. */
      { ...ANSWER, question: "monitoring_method", question_number: 6 },
      COMPLETE,
    ]);
    const sent = JSON.stringify(dataLayer());
    for (const value of ["25-34", "Non-Binary", "TikTok", "Weekly", "Once or twice", "subscribe"]) {
      expect(sent).not.toContain(value);
    }
  });

  it("starts at whatever question the visitor reached first", () => {
    trackStart(definitionOf(V), "posting_volume");
    trackStart(definitionOf(V), "age");
    expect(dataLayer()).toStrictEqual([{ ...START, question_number: 4 }]);
  });

  /* An unreviewed version keeps the shape but uses the backend's own keys — camelCase
     ones included, as v1 served. */
  it("reports an unknown version's questions by their backend keys", () => {
    const v99: QuizDefinition = {
      quiz_version: "likeness-health-v99",
      questions: [
        { key: "age", prompt: "Age?", options: ["Under 18", "18-24"] },
        { key: "pastExploitation", prompt: "New?", options: ["Yes", "No"] },
      ],
    };
    writeFunnel({ quizVersion: v99.quiz_version, answers: { age: "18-24", pastExploitation: "Yes" } });
    trackAnswer(v99, "pastExploitation");
    expect(dataLayer()).toStrictEqual([
      { event: "quiz_start", quiz_version: "likeness-health-v99", question_number: 2 },
      { event: "quiz_answer", quiz_version: "likeness-health-v99", question: "pastExploitation", question_number: 2 },
    ]);
  });

  /* `declaresMinor` matches exact option strings. If the backend rewords the band or
     renames the question, it would stop recognising minors — so nothing is sent. */
  it.each([
    ["the under-18 band is reworded", [{ key: "age", prompt: "Age?", options: ["Under 18 years", "18-24"] }]],
    ["there is no age question", [{ key: "gender", prompt: "Gender?", options: ["Female"] }]],
  ])("sends nothing at all when %s", (_, questions) => {
    const odd: QuizDefinition = { quiz_version: "likeness-health-v98", questions };
    writeFunnel({ quizVersion: odd.quiz_version, answers: { age: "Under 18 years", gender: "Female" } });
    trackStart(odd, questions[0].key);
    trackAnswer(odd, questions[0].key);
    trackComplete(odd);
    expect(dataLayer()).toStrictEqual([]);
  });

  /* A link straight to the last question reaches `finish()` with the rest unanswered. */
  it("sends no completion while any question is unanswered", () => {
    writeFunnel({ quizVersion: V, answers: { age: "25-34", discovery_method: V11_ANSWERS.discovery_method } });
    trackComplete(definitionOf(V));
    expect(dataLayer()).toStrictEqual([]);
    writeFunnel({ quizVersion: V, answers: V11_ANSWERS });
    trackComplete(definitionOf(V));
    expect(dataLayer()).toStrictEqual([{ ...START, question_number: 6 }, COMPLETE]);
  });

  it.each(["__proto__", "constructor", "toString"])(
    "never throws into the quiz for a version named %j",
    (quiz_version) => {
      const odd = { ...definitionOf(V), quiz_version };
      expect(() => {
        trackStart(odd, "age");
        trackAnswer(odd, "platforms");
        trackComplete(odd);
      }).not.toThrow();
    },
  );
});

describe("question numbers", () => {
  const GATED: QuizDefinition = {
    quiz_version: "t-v1",
    questions: [
      { key: "age", prompt: "Age?", options: ["Under 18", "18-24"] },
      { key: "prior_misuse", prompt: "Misused?", options: ["No", "Yes"] },
      {
        key: "discovery_method",
        prompt: "How did you find out?",
        options: ["A friend"],
        requires: { key: "prior_misuse", value: "Yes" },
      },
      { key: "posting_volume", prompt: "How often?", options: ["Daily"] },
    ],
  };

  /* Reporting the gated question, or letting it push `posting_volume` from 3 to 4,
     would tell the container that `prior_misuse` was answered "Yes". */
  it("leaves gated questions out and numbers the rest as if they weren't there", () => {
    expect(GATED.questions.map((q) => reportedQuestionNumber(GATED, q.key))).toStrictEqual([
      1,
      2,
      null,
      3,
    ]);
  });

  it("sends nothing for a gated question, and counts only the others as the total", () => {
    grant();
    loadContainer();
    writeFunnel({ quizVersion: "t-v1", answers: { age: "18-24", prior_misuse: "No", posting_volume: "Daily" } });
    trackAnswer(GATED, "discovery_method");
    trackAnswer(GATED, "posting_volume");
    trackComplete(GATED);
    expect(dataLayer()).toStrictEqual([
      { event: "quiz_start", quiz_version: "t-v1", question_number: 3 },
      { event: "quiz_answer", quiz_version: "t-v1", question: "posting_volume", question_number: 3 },
      { event: "quiz_complete", quiz_version: "t-v1", question_count: 3 },
    ]);
  });
});

/* The reviewed map is data someone will edit. These pin what the banner's drafted
   wording promises, so a copy slip in a new version fails here instead of in GA4. */
describe("the reviewed question map", () => {
  it.each(Object.entries(QUIZ_ANALYTICS_MAP))("%s forwards only what the banner names", (_, questions) => {
    const forwarded = questions.filter((q) => q.forwardAnswer).map((q) => q.id);
    expect(forwarded.every((id) => ["platforms", "posting_volume", "monitoring_method"].includes(id))).toBe(true);
    for (const q of questions) {
      if (["age", "gender", "prior_misuse"].includes(q.key)) expect(q.forwardAnswer).toBe(false);
    }
  });

  it.each(Object.entries(QUIZ_ANALYTICS_MAP))("%s has one entry per id, key and position", (_, questions) => {
    for (const field of ["id", "key", "position"] as const) {
      expect(new Set(questions.map((q) => q[field])).size).toBe(questions.length);
    }
  });

  it.each(Object.entries(QUIZ_ANALYTICS_MAP))("%s options never contain the separator", (_, questions) => {
    for (const q of questions) expect(q.options.some((o) => o.includes("|"))).toBe(false);
  });
});
