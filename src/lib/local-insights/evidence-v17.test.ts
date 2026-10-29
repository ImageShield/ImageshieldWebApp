// @vitest-environment node
import { describe, expect, it } from "vitest";
import { QUESTIONS, REPORT } from "./evidence-v17";
import { RECOMMENDATIONS_V17 } from "./recommendations-v17";

/* `GET /v1/quiz` on the dev API, 2026-10-13 - the definition the report was published
   against. A second transcription to check the first: the evidence mapping was copied
   out of the PDF, this was copied out of the API. */
const V17_OPTIONS: Record<string, readonly string[]> = {
  age: ["Under 18", "18-24", "25-34", "35-54", "55+"],
  gender: ["Female", "Male", "Non-Binary", "Prefer not to say"],
  platforms: ["X (Twitter)", "Snapchat", "Instagram", "Facebook", "TikTok", "YouTube"],
  prior_misuse: ["No known incidents", "Once or twice", "Repeated pattern"],
  posting_volume: [
    "Rarely (less than once a month)",
    "Around once a month",
    "Weekly",
    "Daily or multiple times a day",
  ],
  q_il8uju: [
    "I don’t have a way to monitor my likeness",
    "I rely on friends and family to tell me what they've seen",
    "I subscribe to a likeness detection/monitoring service",
  ],
};

/* Page 1 of the report: "15 of 25 answers are backed by evidence", per question. */
const BACKED_PER_QUESTION: Record<string, number> = {
  age: 3,
  gender: 2,
  platforms: 4,
  prior_misuse: 1,
  posting_volume: 3,
  q_il8uju: 2,
};

const backedEntries = QUESTIONS.flatMap((question) =>
  question.answers.flatMap((entry) => (entry.status === "backed" ? [{ question, entry }] : [])),
);

describe("the v17 evidence transcription", () => {
  it("is for the quiz and scoring the report names", () => {
    expect(REPORT).toMatchObject({
      quizVersion: "likeness-health-v17",
      scoringVersion: "likeness-score-v17",
      release: 14,
    });
  });

  it("covers exactly the live v17 questions and options, in their order", () => {
    expect(
      Object.fromEntries(QUESTIONS.map((q) => [q.key, q.answers.map((a) => a.answer)])),
    ).toStrictEqual(V17_OPTIONS);
    expect(QUESTIONS.find((q) => q.key === "platforms")?.multi).toBe(true);
    expect(QUESTIONS.filter((q) => q.multi)).toHaveLength(1);
  });

  /* "Backed" on page 1 includes the three whose detail couldn't load. */
  it("agrees with the report's own count of backed answers", () => {
    const counted = Object.fromEntries(
      QUESTIONS.map((q) => [
        q.key,
        q.answers.filter((a) => a.status === "backed" || a.status === "unavailable").length,
      ]),
    );
    expect(counted).toStrictEqual(BACKED_PER_QUESTION);
    expect(Object.values(counted).reduce((sum, n) => sum + n, 0)).toBe(15);
    expect(QUESTIONS.flatMap((q) => q.answers)).toHaveLength(25);
  });

  it("gives every backed answer a short title, a bounded line and its sources", () => {
    expect(backedEntries).toHaveLength(12);
    for (const { entry } of backedEntries) {
      expect(entry.title.length, entry.answer).toBeLessThanOrEqual(40);
      expect(entry.line.length, entry.answer).toBeLessThanOrEqual(160);
      expect(entry.sources.length, entry.answer).toBeGreaterThan(0);
      for (const url of entry.sources) expect(new URL(url).protocol).toBe("https:");
    }
  });

  /* The reasoning is written for whoever sets the points; the line is for the visitor. */
  it("keeps the report's talk about scoring out of every line", () => {
    for (const { entry } of backedEntries) {
      expect(entry.line, entry.answer).not.toMatch(/deduction|live value|points?\b|suggest/i);
    }
  });

  /* Page 1: backed means at least two publishers. An entry the report calls backed on
     fewer has to say why it is trusted anyway. */
  it("flags any backed answer whose cited sources come from one publisher", () => {
    const thin = backedEntries.filter(
      ({ entry }) => new Set(entry.sources.map((url) => new URL(url).hostname)).size < 2,
    );
    expect(thin.map(({ entry }) => entry.answer)).toStrictEqual(["Non-Binary"]);
    for (const { entry } of thin) expect(entry.note).toBeTruthy();
  });
});

describe("the v17 recommendation catalogue", () => {
  const cited = new Set(backedEntries.flatMap(({ entry }) => entry.sources));

  it("is triggered only by real v17 answers", () => {
    for (const { when, id } of RECOMMENDATIONS_V17) {
      expect(V17_OPTIONS[when.key], id).toBeDefined();
      for (const answer of when.answers) expect(V17_OPTIONS[when.key], id).toContain(answer);
    }
  });

  it("is never triggered by age or gender", () => {
    for (const { when } of RECOMMENDATIONS_V17) expect(["age", "gender"]).not.toContain(when.key);
  });

  it("links only to pages the report cites", () => {
    for (const { link, id } of RECOMMENDATIONS_V17) expect(cited, id).toContain(link.url);
  });

  it("keeps each to a short instruction and one sentence", () => {
    for (const { title, body, id } of RECOMMENDATIONS_V17) {
      expect(title.length, id).toBeLessThanOrEqual(80);
      expect(body.length, id).toBeLessThanOrEqual(200);
      expect(body, id).toMatch(/^[^.]*\.$/);
    }
  });
});
