import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoreEnvelope } from "@/lib/score";
import { readAsUser } from "@/lib/session";
import { ApiFailure } from "@/lib/v1/errors";
import ScorePage from "./page";

/* Only the transport to /v1 is replaced. `readMe`, `readScore`, `loadScore` and the
   whole result screen run as they do in production, so what is asserted below is the
   chain from the API's response to the number on screen. */
vi.mock("@/lib/session", () => ({
  readAsUser: vi.fn(),
  SessionUnavailable: class SessionUnavailable extends Error {},
}));
/* Labels only — the page renders without them. */
vi.mock("@/lib/quiz-definition", () => ({ readVisitorQuizDefinition: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

/* An app user's stored score, as `GET /v1/me/score` answers it: not a fresh quiz
   result, but one that has recovered points since. */
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
    breakdown: {
      quiz: [
        { key: "age", value: "25-34", deduction: 5, type: "demographic" },
        { key: "gender", value: "Female", deduction: 6, type: "demographic" },
        { key: "posting_volume", value: "Weekly", deduction: 7, type: "exposure" },
      ],
      dynamic: [],
      escrow: { next_milestone_days: null },
    },
  },
  scope_note: "Computed from your quiz, photos and coverage.",
};

const ME = {
  account: { phone_e164: "+447700900123", status: "active" },
  person: { person_id: "p_1", first_name: "Ada", last_name: "Lovelace" },
  onboarding: { next_step: null, quiz_completed: true },
  score: { live: 89, band: "low risk", computed_at: STORED.score!.computed_at },
};

const QUIZ_OUTDATED = new ApiFailure(
  404,
  "QUIZ_OUTDATED",
  "the quiz was taken against a retired version - take it again",
  null,
  null,
);

/** What the two reads answer; a test swaps either. */
let answers: { me: unknown; score: ScoreEnvelope | ApiFailure };

beforeEach(() => {
  answers = { me: ME, score: STORED };
  vi.mocked(redirect).mockReset();
  vi.mocked(readAsUser)
    .mockReset()
    .mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/v1/me") return answers.me;
      if (method === "GET" && path === "/v1/me/score") {
        if (answers.score instanceof ApiFailure) throw answers.score;
        return answers.score;
      }
      throw new Error(`unexpected ${method} ${path}`);
    });
  /* The share button fetches its poster on mount; there isn't one here. */
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/score", () => {
  it("shows the score stored on the record, exactly as served", async () => {
    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 89 out of 100 — low risk" }),
    ).toBeTruthy();
    expect(screen.getByText("89", { selector: "strong" })).toBeTruthy();
    // Read, not written: the page's only calls to /v1 are these two reads.
    expect(vi.mocked(readAsUser).mock.calls.map(([method, path]) => `${method} ${path}`).sort())
      .toStrictEqual(["GET /v1/me", "GET /v1/me/score"]);
  });

  /* The app user's case: their quiz was taken on a version since retired, so
     /v1/me/score has no record — but the account still holds the score the app shows,
     and that is the one shown here, not a retake. */
  it("shows the account's stored score for a quiz taken on a retired version", async () => {
    answers = {
      me: { ...ME, score: { live: 74, band: "moderate risk", computed_at: "2026-07-01T00:00:00.000Z" } },
      score: QUIZ_OUTDATED,
    };

    render(await ScorePage());

    expect(redirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("img", { name: "Likeness Health Score 74 out of 100 — moderate risk" }),
    ).toBeTruthy();
    expect(screen.getByText("74", { selector: "strong" })).toBeTruthy();
    // No breakdown on the stored score, so no risk-factor card rather than an empty one.
    expect(screen.queryByText(/primary risk factors/i)).toBeNull();
  });

  it("still sends a retired quiz to be retaken when the account has no score", async () => {
    answers = { me: { ...ME, score: null }, score: QUIZ_OUTDATED };

    await ScorePage();

    expect(redirect).toHaveBeenCalledWith("/quiz/questions");
  });
});
