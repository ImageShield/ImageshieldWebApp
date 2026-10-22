import { beforeEach, expect, it, vi } from "vitest";
import { track, trackAnswer } from "./analytics";
import { writeConsent } from "./consent";
import { writeFunnel } from "./funnel-state";
import type { QuizDefinition } from "./quiz";

/* A map edited wrongly: every question marked for forwarding, switch on. The
   never-forwarded rule must still hold — it is code, not a value in the table. */
vi.mock("./analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: true }));
vi.mock("./analytics-quiz-map", () => ({
  QUIZ_ANALYTICS_MAP: {
    "t-v1": [
      { key: "age", id: "age", position: 1, prompt: "Age?", multi: false, options: ["Under 18", "25-34"], forwardAnswer: true },
      { key: "gender", id: "gender", position: 2, prompt: "Gender?", multi: false, options: ["Non-Binary"], forwardAnswer: true },
      /* A sensitive key aliased to an approved-looking id. */
      { key: "prior_misuse", id: "platforms", position: 3, prompt: "Misused?", multi: false, options: ["Once or twice"], forwardAnswer: true },
    ],
  },
}));

const DEFINITION: QuizDefinition = {
  quiz_version: "t-v1",
  questions: [
    { key: "age", prompt: "Age?", options: ["Under 18", "25-34"] },
    { key: "gender", prompt: "Gender?", options: ["Non-Binary"] },
    { key: "prior_misuse", prompt: "Misused?", options: ["Once or twice"] },
  ],
};

beforeEach(() => {
  window.sessionStorage.clear();
  writeConsent({ analytics: true, marketing: false });
  vi.stubGlobal("dataLayer", []);
  writeFunnel({ quizVersion: "t-v1", answers: { age: "25-34", gender: "Non-Binary", prior_misuse: "Once or twice" } });
});

it("never sends an age, gender or prior-misuse answer, whatever the map says", () => {
  for (const q of DEFINITION.questions) trackAnswer(DEFINITION, q.key);
  track({ event: "quiz_answer", quiz_version: "t-v1", question: "gender", question_number: 2, answer: "Non-Binary" });
  const sent = JSON.stringify((window as Window & { dataLayer?: unknown[] }).dataLayer);
  for (const value of ["25-34", "Non-Binary", "Once or twice"]) expect(sent).not.toContain(value);
});
