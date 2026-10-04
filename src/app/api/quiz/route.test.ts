// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../tools/dev-api/quiz.json";
import type { QuizAnswers, QuizDefinition } from "@/lib/quiz";
import { readLiveQuizDefinition } from "@/lib/quiz-definition";
import { saveQuizAnswers } from "@/lib/quiz-save";
import { POST } from "./route";

/* The real `validateAnswers` and `declaresMinor` run; only the session, the rate
   limit, the definition read and the scorer write are replaced. */
vi.mock("@/lib/session", () => ({
  readSession: async () => ({ access: "a", refresh: "r", accessExp: 9e9 }),
  SessionUnavailable: class SessionUnavailable extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ allowPerIp: () => true }));
vi.mock("@/lib/quiz-definition", () => ({
  readLiveQuizDefinition: vi.fn(),
  noteVersionDrift: () => {},
}));
vi.mock("@/lib/quiz-save", () => ({ saveQuizAnswers: vi.fn() }));

/* The live quiz's age options, as `GET /v1/quiz` served them on 2026-10-05. */
const LIVE: QuizDefinition = {
  quiz_version: "likeness-health-v11",
  questions: [
    {
      key: "age",
      prompt: "What is your age?",
      options: ["Under 18", "18-24", "25-34", "35-54", "55+"],
    },
    { key: "gender", prompt: "What is your gender?", options: ["Female", "Male"] },
  ],
};
/* The repo's dev fixture, which still serves the older "13-17" band. */
const FIXTURE = fixture as unknown as QuizDefinition;

/** A full set of answers to `definition`, with the given age. */
function answersFor(definition: QuizDefinition, age: string): QuizAnswers {
  const answers: QuizAnswers = { age };
  for (const q of definition.questions) {
    if (q.key !== "age") answers[q.key] = q.multi ? [q.options[0]] : q.options[0];
  }
  return answers;
}

const post = (definition: QuizDefinition, answers: QuizAnswers) =>
  POST(
    new Request("http://localhost/api/quiz", {
      method: "POST",
      body: JSON.stringify({ quizVersion: definition.quiz_version, answers }),
    }),
  );

beforeEach(() => {
  vi.mocked(readLiveQuizDefinition).mockReset().mockResolvedValue(LIVE);
  vi.mocked(saveQuizAnswers).mockReset().mockResolvedValue({} as never);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/quiz", () => {
  describe("refuses an under-18 answer before it reaches the scorer", () => {
    it('rejects "Under 18" from the live quiz', async () => {
      const res = await post(LIVE, answersFor(LIVE, "Under 18"));

      expect(res.status).toBe(403);
      expect(await res.json()).toStrictEqual({
        error: "The Likeness Health Score is only available to people aged 18 and over.",
        notEligible: true,
      });
      expect(saveQuizAnswers).not.toHaveBeenCalled();
    });

    it('rejects "13-17" from the dev fixture', async () => {
      vi.mocked(readLiveQuizDefinition).mockResolvedValue(FIXTURE);

      const res = await post(FIXTURE, answersFor(FIXTURE, "13-17"));

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ notEligible: true });
      expect(saveQuizAnswers).not.toHaveBeenCalled();
    });
  });

  describe("adult answers", () => {
    it("are scored exactly as before", async () => {
      const answers = answersFor(LIVE, "18-24");
      const res = await post(LIVE, answers);

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true });
      expect(saveQuizAnswers).toHaveBeenCalledWith("likeness-health-v11", answers);
    });

    it("are scored on the dev fixture too", async () => {
      vi.mocked(readLiveQuizDefinition).mockResolvedValue(FIXTURE);

      const res = await post(FIXTURE, answersFor(FIXTURE, "18-24"));

      expect(res.status).toBe(200);
      expect(saveQuizAnswers).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing validation", () => {
    it("still turns an off-menu answer into a retake", async () => {
      const res = await post(LIVE, answersFor(LIVE, "17"));

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ retakeQuiz: true });
      expect(saveQuizAnswers).not.toHaveBeenCalled();
    });

    it("still turns an incomplete set into a retake", async () => {
      const res = await post(LIVE, { age: "18-24" });

      expect(res.status).toBe(409);
      expect(saveQuizAnswers).not.toHaveBeenCalled();
    });
  });
});
