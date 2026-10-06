// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../tools/dev-api/quiz.json";
import type { QuizAnswers, QuizDefinition } from "@/lib/quiz";
import { readLiveQuizDefinition } from "@/lib/quiz-definition";
import type { ScoreEnvelope } from "@/lib/score";
import { SessionUnavailable } from "@/lib/session";
import { ApiFailure } from "@/lib/v1/errors";
import { fetchMe, type Me } from "@/lib/v1/me";
import { fetchScore, submitQuizResponses } from "@/lib/v1/quiz";
import { POST } from "./route";

/* The real `validateAnswers`, `declaresMinor`, `hasScoreOnRecord` and `storedScoreOf`
   run; only the session, the rate limit, the definition read and the /v1 reads and
   write are replaced. Stubbing at `v1/quiz` rather than at `quiz-save` is what lets
   these tests say "POST /v1/quiz/responses was not sent" and mean exactly that. */
vi.mock("@/lib/session", () => ({
  readSession: async () => ({ access: "a", refresh: "r", accessExp: 9e9 }),
  SessionUnavailable: class SessionUnavailable extends Error {},
}));
vi.mock("@/lib/rate-limit", () => ({ allowPerIp: () => true }));
vi.mock("@/lib/quiz-definition", () => ({
  readLiveQuizDefinition: vi.fn(),
  noteVersionDrift: () => {},
}));
vi.mock("@/lib/v1/quiz", () => ({
  fetchScore: vi.fn(),
  submitQuizResponses: vi.fn(),
}));
vi.mock("@/lib/v1/me", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/v1/me")>()),
  fetchMe: vi.fn(),
}));

/** `GET /v1/me` for this account, carrying `score` as the collection shows it. */
const meWith = (score: Me["score"]) => ({ score }) as Me;

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

/* `GET /v1/me/score` as the collection documents it, for an app user who took the
   quiz long ago and has since recovered points. */
const STORED: ScoreEnvelope = {
  score: {
    live: 89,
    band: "low risk",
    baseline: 74,
    recovered: 8,
    escrow_released: 7,
    dynamic_deduction: 0,
    current_ceiling: 92,
    maximum_ceiling: 100,
    scoring_version: "likeness-score-v4",
    quiz_version: "likeness-health-v3",
    computed_at: "2026-08-31T09:12:44.000Z",
    breakdown: { quiz: [], dynamic: [], escrow: { next_milestone_days: null } },
  },
  scope_note: "Computed from your quiz, photos and coverage.",
};

/** The two "no data" 404s `GET /v1/me/score` answers with, body and all. */
const notFound = (code: string, message: string) =>
  new ApiFailure(404, code, message, null, { error: code, message });
const NO_QUIZ_RESPONSE = notFound("NO_QUIZ_RESPONSE", "no quiz response yet");
const QUIZ_OUTDATED = notFound(
  "QUIZ_OUTDATED",
  "the quiz was taken against a retired version - take it again",
);

beforeEach(() => {
  vi.mocked(readLiveQuizDefinition).mockReset().mockResolvedValue(LIVE);
  /* A new account unless a test says otherwise, which is what every test outside the
     "already has a score" block was written against. */
  vi.mocked(fetchScore).mockReset().mockRejectedValue(NO_QUIZ_RESPONSE);
  vi.mocked(submitQuizResponses).mockReset().mockResolvedValue({} as never);
  vi.mocked(fetchMe).mockReset().mockResolvedValue(meWith(null));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
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
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });

    it('rejects "13-17" from the dev fixture', async () => {
      vi.mocked(readLiveQuizDefinition).mockResolvedValue(FIXTURE);

      const res = await post(FIXTURE, answersFor(FIXTURE, "13-17"));

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ notEligible: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });
  });

  describe("adult answers", () => {
    it("are scored exactly as before", async () => {
      const answers = answersFor(LIVE, "18-24");
      const res = await post(LIVE, answers);

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true });
      expect(submitQuizResponses).toHaveBeenCalledWith("likeness-health-v11", answers);
    });

    it("are scored on the dev fixture too", async () => {
      vi.mocked(readLiveQuizDefinition).mockResolvedValue(FIXTURE);

      const res = await post(FIXTURE, answersFor(FIXTURE, "18-24"));

      expect(res.status).toBe(200);
      expect(submitQuizResponses).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing validation", () => {
    it("still turns an off-menu answer into a retake", async () => {
      const res = await post(LIVE, answersFor(LIVE, "17"));

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ retakeQuiz: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });

    it("still turns an incomplete set into a retake", async () => {
      const res = await post(LIVE, { age: "18-24" });

      expect(res.status).toBe(409);
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });
  });

  /* The questions come before the phone number, so an app user signing in here
     arrives with a fresh set of web answers. The record decides whether they are
     written, never the answers. */
  describe("an account that already has a score", () => {
    it("keeps it — POST /v1/quiz/responses is never sent", async () => {
      vi.mocked(fetchScore).mockResolvedValue(STORED);

      const res = await post(LIVE, answersFor(LIVE, "18-24"));

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true, kept: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
      // Not even judged: there is nothing to validate answers for.
      expect(readLiveQuizDefinition).not.toHaveBeenCalled();
    });

    it("keeps answers whose score is still being computed", async () => {
      vi.mocked(fetchScore).mockResolvedValue({ score: null, scope_note: "" });

      const res = await post(LIVE, answersFor(LIVE, "18-24"));

      expect(await res.json()).toStrictEqual({ ok: true, kept: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });

    /* Leftover answers that wouldn't fit the live quiz used to mean a "quiz has been
       updated" retake. For an account that already has a score that would be asking
       them to redo a quiz nobody is going to write. */
    it("keeps it even when the tab's answers no longer fit the live quiz", async () => {
      vi.mocked(fetchScore).mockResolvedValue(STORED);

      const res = await post(LIVE, answersFor(LIVE, "17"));

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true, kept: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });

    /* Answered in the app against a quiz version since retired: no current record,
       but the account still carries its score, and that is the one it keeps. */
    it("keeps the stored score of a quiz taken on a retired version", async () => {
      vi.mocked(fetchScore).mockRejectedValue(QUIZ_OUTDATED);
      vi.mocked(fetchMe).mockResolvedValue(
        meWith({ live: 74, band: "moderate risk", computed_at: "2026-07-01T00:00:00.000Z" }),
      );

      const res = await post(LIVE, answersFor(LIVE, "18-24"));

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true, kept: true });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });
  });

  describe("an account with no score at all", () => {
    it("is scored when it has never taken the quiz (NO_QUIZ_RESPONSE)", async () => {
      vi.mocked(fetchScore).mockRejectedValue(NO_QUIZ_RESPONSE);
      const answers = answersFor(LIVE, "25-34");

      const res = await post(LIVE, answers);

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true });
      expect(submitQuizResponses).toHaveBeenCalledWith("likeness-health-v11", answers);
    });

    /* Retired quiz version and no number left on the account: nothing to show but a
       new score, so this is still the retake the score screen sends it to. */
    it("is scored when its quiz was retired and no score is stored", async () => {
      vi.mocked(fetchScore).mockRejectedValue(QUIZ_OUTDATED);
      vi.mocked(fetchMe).mockResolvedValue(meWith(null));
      const answers = answersFor(LIVE, "35-54");

      const res = await post(LIVE, answers);

      expect(res.status).toBe(200);
      expect(await res.json()).toStrictEqual({ ok: true });
      expect(submitQuizResponses).toHaveBeenCalledWith("likeness-health-v11", answers);
    });
  });

  describe("when the record can't be read", () => {
    /* A blip says nothing about whether there is a score, and guessing "none" would
       overwrite a real one. */
    it("writes nothing and asks for a retry", async () => {
      vi.mocked(fetchScore).mockRejectedValue(
        new ApiFailure(503, "UPSTREAM_UNAVAILABLE", "briefly unavailable", null, null),
      );

      const res = await post(LIVE, answersFor(LIVE, "18-24"));

      expect(res.status).toBe(502);
      expect(await res.json()).toStrictEqual({
        error: "We couldn't check your score just now. Please try again.",
      });
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });

    it("sends a dead session back to start", async () => {
      vi.mocked(fetchScore).mockRejectedValue(new SessionUnavailable("signed-out"));

      const res = await post(LIVE, answersFor(LIVE, "18-24"));

      expect(res.status).toBe(401);
      expect(submitQuizResponses).not.toHaveBeenCalled();
    });
  });
});
