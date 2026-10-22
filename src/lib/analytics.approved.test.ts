import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnalyticsEvent, track, trackAnswer } from "./analytics";
import { definitionOf } from "./analytics.fixtures";
import { writeConsent } from "./consent";
import { writeFunnel } from "./funnel-state";
import type { QuizDefinition } from "./quiz";

/* What legal approving the banner wording turns on. */
vi.mock("./analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: true }));

/* The answer events only: each `trackAnswer` sends a `quiz_start` first when none has
   gone yet, which analytics.test.ts covers. Cleared (undefined) fields left out. */
const dataLayer = () => {
  const pushed = (window as Window & { dataLayer?: { event: string }[] }).dataLayer;
  return (
    pushed &&
    (JSON.parse(JSON.stringify(pushed.filter((e) => e.event === "quiz_answer"))) as unknown[])
  );
};

const answerOf = (v: string, question: string, question_number: number, answer?: string) => ({
  event: "quiz_answer",
  quiz_version: v,
  question,
  question_number,
  ...(answer === undefined ? {} : { answer }),
});

beforeEach(() => {
  window.sessionStorage.clear();
  writeConsent({ analytics: true, marketing: false });
  vi.stubGlobal("dataLayer", []);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "imageshield_consent=; Max-Age=0; Path=/";
});

describe("answers, once approved", () => {
  it("v11 (prod): sends the options for approved questions and never age, gender or misuse", () => {
    const v = "likeness-health-v11";
    writeFunnel({
      quizVersion: v,
      answers: {
        age: "25-34",
        gender: "Non-Binary",
        platforms: ["TikTok", "X (Twitter)", "Instagram"],
        posting_volume: "Weekly",
        prior_misuse: "Happens regularly",
        discovery_method: "I rely on friends and family to tell me what they've seen",
      },
    });
    const v11 = definitionOf(v);
    for (const q of v11.questions) trackAnswer(v11, q.key);
    expect(dataLayer()).toStrictEqual([
      answerOf(v, "age", 1),
      answerOf(v, "gender", 2),
      /* The definition's order, not the order they were ticked in. */
      answerOf(v, "platforms", 3, "X (Twitter)|Instagram|TikTok"),
      answerOf(v, "posting_volume", 4, "Weekly"),
      answerOf(v, "prior_misuse", 5),
      answerOf(v, "monitoring_method", 6, "I rely on friends and family to tell me what they've seen"),
    ]);
  });

  it("v17 (dev): same ids and answers, despite different keys and order", () => {
    const v = "likeness-health-v17";
    writeFunnel({
      quizVersion: v,
      answers: {
        age: "18-24",
        gender: "Female",
        platforms: ["YouTube"],
        prior_misuse: "Repeated pattern",
        posting_volume: "Daily or multiple times a day",
        q_il8uju: "I don’t have a way to monitor my likeness",
      },
    });
    const v17 = definitionOf(v);
    for (const q of v17.questions) trackAnswer(v17, q.key);
    expect(dataLayer()).toStrictEqual([
      answerOf(v, "age", 1),
      answerOf(v, "gender", 2),
      answerOf(v, "platforms", 3, "YouTube"),
      answerOf(v, "prior_misuse", 4),
      answerOf(v, "posting_volume", 5, "Daily or multiple times a day"),
      answerOf(v, "monitoring_method", 6, "I don’t have a way to monitor my likeness"),
    ]);
  });

  it("encodes every platform within GA4's 100-character limit", () => {
    const v = "likeness-health-v11";
    const all = ["X (Twitter)", "Snapchat", "Instagram", "Facebook", "TikTok", "YouTube"];
    writeFunnel({ quizVersion: v, answers: { age: "25-34", platforms: [...all].reverse() } });
    trackAnswer(definitionOf(v), "platforms");
    expect(dataLayer()).toStrictEqual([answerOf(v, "platforms", 3, all.join("|"))]);
    expect(all.join("|").length).toBeLessThanOrEqual(100);
  });

  it("sends only options the definition offers", () => {
    const v = "likeness-health-v11";
    writeFunnel({ quizVersion: v, answers: { age: "25-34", platforms: ["LinkedIn", "TikTok"] } });
    trackAnswer(definitionOf(v), "platforms");
    expect(dataLayer()).toStrictEqual([answerOf(v, "platforms", 3, "TikTok")]);
  });

  /* Never mapped onto a reviewed version: an unknown one sends no answers at all. */
  it("sends no answer for an unreviewed quiz version", () => {
    const v12 = { ...definitionOf("likeness-health-v11"), quiz_version: "likeness-health-v12" };
    writeFunnel({ quizVersion: v12.quiz_version, answers: { age: "25-34", posting_volume: "Weekly" } });
    trackAnswer(v12, "posting_volume");
    expect(dataLayer()).toStrictEqual([answerOf("likeness-health-v12", "posting_volume", 4)]);
  });

  /* `discovery_method` once asked how someone found out about abuse. */
  it("sends no answer for a reviewed version whose question has changed in place", () => {
    const v = "likeness-health-v11";
    const edited: QuizDefinition = {
      ...definitionOf(v),
      questions: definitionOf(v).questions.map((q) =>
        q.key === "discovery_method"
          ? { ...q, prompt: "How did you find out about the abuse?", options: ["A friend told me"] }
          : q,
      ),
    };
    writeFunnel({ quizVersion: v, answers: { age: "25-34", discovery_method: "A friend told me" } });
    trackAnswer(edited, "discovery_method");
    expect(dataLayer()).toStrictEqual([answerOf(v, "discovery_method", 6)]);
  });

  /* The options alone still match here: only the wording or the place changed. */
  it.each([
    ["reworded", (q: QuizDefinition["questions"][number]) => ({ ...q, prompt: "How do you post?" })],
  ])("sends no answer for a question %s in place", (_, change) => {
    const v = "likeness-health-v11";
    const edited: QuizDefinition = {
      ...definitionOf(v),
      questions: definitionOf(v).questions.map((q) => (q.key === "posting_volume" ? change(q) : q)),
    };
    writeFunnel({ quizVersion: v, answers: { age: "25-34", posting_volume: "Weekly" } });
    trackAnswer(edited, "posting_volume");
    expect(dataLayer()).toStrictEqual([answerOf(v, "posting_volume", 4)]);
  });

  it("sends no answer for a question moved to another position", () => {
    const v = "likeness-health-v11";
    const base = definitionOf(v).questions;
    const moved: QuizDefinition = { quiz_version: v, questions: [base[0], base[1], base[3], base[2], base[4], base[5]] };
    writeFunnel({ quizVersion: v, answers: { age: "25-34", posting_volume: "Weekly" } });
    trackAnswer(moved, "posting_volume");
    expect(dataLayer()).toStrictEqual([answerOf(v, "posting_volume", 3)]);
  });

  /* `track` is exported; the map holds even when `trackAnswer` is bypassed. */
  it.each([
    ["gender", 2, "Non-Binary"],
    ["prior_misuse", 5, "Once or twice"],
    ["age", 1, "25-34"],
    ["platforms", 3, "LinkedIn"],
    ["platforms", 3, "TikTok|TikTok"],
    ["platforms", 3, "x".repeat(101)],
    ["posting_volume", 4, "Weekly|Daily or multiple times a day"],
    /* Defined options, but not in the quiz's order: not the one encoding. */
    ["platforms", 3, "TikTok|X (Twitter)"],
  ] as const)("strips a direct %s answer of %j", (question, n, answer) => {
    const v = "likeness-health-v11";
    track({ event: "quiz_answer", quiz_version: v, question, question_number: n, answer } as AnalyticsEvent);
    expect(dataLayer()).toStrictEqual([answerOf(v, question, n)]);
  });

  it("still sends nothing at all once the age answer is under 18", () => {
    const v = "likeness-health-v11";
    writeFunnel({ quizVersion: v, answers: { age: "Under 18", platforms: ["TikTok"] } });
    for (const q of definitionOf(v).questions) trackAnswer(definitionOf(v), q.key);
    expect(dataLayer()).toStrictEqual([]);
  });

  it("still sends nothing without analytics consent", () => {
    writeConsent({ analytics: false, marketing: false });
    const v = "likeness-health-v11";
    writeFunnel({ quizVersion: v, answers: { age: "25-34", platforms: ["TikTok"] } });
    trackAnswer(definitionOf(v), "platforms");
    expect(dataLayer()).toStrictEqual([]);
  });
});
