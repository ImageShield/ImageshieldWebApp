// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { QuizDefinition, QuizQuestion } from "../quiz";
import { QUESTIONS, REPORT } from "./evidence-v17";
import { VERSIONS } from "./versions";

/* `GET /v1/quiz` on 2026-10-13: prod.imageshield.com served v11, dev.imageshield.com
   v17 - the quiz the evidence report covers. */
const V11: QuizDefinition = {
  quiz_version: "likeness-health-v11",
  questions: [
    { key: "age", prompt: "What's your age?", scored: true, options: ["Under 18", "18-24", "25-34", "35-54", "55+"] },
    { key: "gender", prompt: "What's your gender?", scored: true, options: ["Female", "Male", "Non-Binary", "Prefer not to say"] },
    {
      key: "platforms",
      multi: true,
      prompt: "Which platforms do you use?",
      scored: true,
      options: ["X (Twitter)", "Snapchat", "Instagram", "Facebook", "TikTok", "YouTube"],
      required: false,
    },
    {
      key: "posting_volume",
      prompt: "How often are photos of you shared online, either by you or by others?",
      scored: true,
      options: ["Rarely (less than once a month)", "Around once a month", "Weekly", "Daily or multiple times a day"],
    },
    {
      key: "prior_misuse",
      prompt: "Have your photos or likeness ever been misused before (that you know of)?",
      scored: true,
      options: ["No known incidents", "Once or twice", "Happens regularly"],
    },
    {
      key: "discovery_method",
      prompt: "How do you monitor how your face, your likeness is used online?",
      scored: true,
      options: [
        "I don’t have a way to monitor my likeness",
        "I rely on friends and family to tell me what they've seen",
        "I subscribe to a likeness detection/monitoring service",
      ],
    },
  ],
};

const V17: QuizDefinition = {
  quiz_version: "likeness-health-v17",
  questions: [
    V11.questions[0],
    V11.questions[1],
    V11.questions[2],
    {
      key: "prior_misuse",
      prompt: "Have your photos or likeness ever been misused before (that you know of)?",
      scored: true,
      options: ["No known incidents", "Once or twice", "Repeated pattern"],
    },
    {
      key: "posting_volume",
      prompt: "How often do you post new images of yourself?",
      scored: true,
      options: ["Rarely (less than once a month)", "Around once a month", "Weekly", "Daily or multiple times a day"],
    },
    { ...V11.questions[5], key: "q_il8uju" },
  ],
};

/** Everything that makes two questions the same question, apart from the key. */
const asked = ({ prompt, options, multi, scored, required, requires }: QuizQuestion) => ({
  prompt,
  options,
  multi,
  scored,
  required,
  requires,
});

const byKey = (definition: QuizDefinition) => new Map(definition.questions.map((q) => [q.key, q]));

describe("the quiz versions the v17 evidence covers", () => {
  it("are v17, on the scoring the report prices, and v11", () => {
    expect(Object.keys(VERSIONS).sort()).toStrictEqual(["likeness-health-v11", "likeness-health-v17"]);
    expect(VERSIONS[REPORT.quizVersion]).toMatchObject({
      scoringVersion: "likeness-score-v17",
      rank: "published",
    });
  });

  it("maps every v17 question to itself", () => {
    const { questions, omitted } = VERSIONS[REPORT.quizVersion];
    expect(questions).toStrictEqual(Object.fromEntries(QUESTIONS.map((q) => [q.key, q.key])));
    expect(omitted).toStrictEqual([]);
  });

  /* The whole case for reading a v11 answer with v17 evidence: it is the same answer
     to the same question. */
  it("maps a v11 question only when v17 asks it word for word", () => {
    const v11 = byKey(V11);
    const v17 = byKey(V17);
    for (const [from, to] of Object.entries(VERSIONS["likeness-health-v11"].questions)) {
      expect(asked(v11.get(from)!), `${from} → ${to}`).toStrictEqual(asked(v17.get(to)!));
    }
  });

  it("accounts for every v11 question, and omits exactly the ones v17 asks differently", () => {
    const { questions, omitted } = VERSIONS["likeness-health-v11"];
    const v17Prompts = new Set(V17.questions.map((q) => JSON.stringify(asked(q))));
    const differs = V11.questions
      .filter((q) => !v17Prompts.has(JSON.stringify(asked(q))))
      .map((q) => q.key);

    expect(differs).toStrictEqual(["posting_volume", "prior_misuse"]);
    expect([...omitted].sort()).toStrictEqual(differs);
    expect([...Object.keys(questions), ...omitted].sort()).toStrictEqual(
      V11.questions.map((q) => q.key).sort(),
    );
  });

  /* v11's points are unpublished, so they're never taken from the report. */
  it("ranks v11 by the record's own deductions, whatever scoring it carries", () => {
    expect(VERSIONS["likeness-health-v11"]).toMatchObject({ scoringVersion: null, rank: "recorded" });
  });
});
