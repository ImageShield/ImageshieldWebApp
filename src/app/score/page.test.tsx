import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneralRecommendation } from "@/lib/recommendations";
import type { RiskFactor, ScoreEnvelope } from "@/lib/score";
import { ApiFailure } from "@/lib/api-client";

/* Mock the browser-session module. */
vi.mock("@/lib/browser-session", () => ({
  hasSession: vi.fn(() => true),
  isAccessExpired: vi.fn(() => false),
  accessToken: vi.fn(() => "test-token"),
  refreshToken: vi.fn(() => "test-refresh"),
  adoptTokens: vi.fn(),
  clearSession: vi.fn(),
}));

/* Mock the api-client's callAsUser to return test data. */
const mockCallAsUser = vi.fn();
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual("@/lib/api-client") as Record<string, unknown>;
  return {
    ...actual,
    callAsUser: (...args: unknown[]) => mockCallAsUser(...args),
    refreshSession: vi.fn(async () => true),
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

/* Re-export ApiFailure for test use. */
const { ApiFailure: AF } = await import("@/lib/api-client");

const RISK_FACTORS: RiskFactor[] = [
  {
    kind: "threat",
    key: "evt_7f3a",
    title: "A live incident",
    line: "Fixture line: an incident is affecting people who answered like you.",
    points: 4,
  },
  {
    kind: "quiz",
    key: "posting_volume",
    title: "Posting volume",
    line: "Fixture line: how often you post publicly.",
    points: 9,
  },
  { kind: "quiz", key: "age", title: "Age", line: "Fixture line about your age.", points: 6 },
];

const RECOMMENDATIONS: GeneralRecommendation[] = [
  {
    title: "Fixture: turn on likeness monitoring",
    body: "Fixture body one.",
    link: { url: "https://example.org/guide", label: "Read the guide" },
  },
  {
    title: "Fixture: review who can see your posts",
    body: "Fixture body two.",
    link: { url: "https://www.example.com/research/privacy", label: null },
  },
  { title: "Fixture: report misuse when you find it", body: "Fixture body three.", link: null },
];

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
    risk_factors: RISK_FACTORS,
  },
  scope_note: "Computed from your quiz, photos and coverage.",
  general_recommendations: RECOMMENDATIONS,
};

const FACTORS_HEADING = "The primary risk factors that determined your initial score";
const RECOMMENDATIONS_HEADING = "General recommendations";

const card = (heading: string) =>
  screen.getByRole("heading", { name: heading, level: 2 }).closest("section")!;

const rowsOf = (section: HTMLElement) =>
  within(section)
    .getAllByRole("listitem")
    .map((row) => [row.querySelector("h3")!.textContent, row.querySelector("p")!.textContent]);

const RETIRED_COPY = [
  /Adults 19–35 account for 75%/,
  /96% of non-consensual deepfake content/,
  /Regular public posting increases your likeness exposure/,
  /YouTube's free likeness detection service/,
  /Keep your social media private/,
];

const expectNoRetiredCopy = () => {
  for (const copy of RETIRED_COPY) expect(screen.queryByText(copy)).toBeNull();
};

const ME = {
  account: { phone_e164: "+447700900123", status: "active" },
  person: { person_id: "p_1", first_name: "Ada", last_name: "Lovelace" },
  onboarding: { next_step: null, quiz_completed: true },
  score: { live: 89, band: "low risk", computed_at: STORED.score!.computed_at },
};

const QUIZ_OUTDATED = new AF(
  404,
  "QUIZ_OUTDATED",
  "the quiz was taken against a retired version - take it again",
  null,
  null,
);
let answers: { me: unknown; score: ScoreEnvelope | ApiFailure };

beforeEach(() => {
  answers = { me: ME, score: STORED };
  mockCallAsUser.mockReset().mockImplementation(async (method: string, path: string) => {
    if (method === "GET" && path === "/v1/me") return answers.me;
    if (method === "GET" && path === "/v1/me/score") {
      if (answers.score instanceof AF) throw answers.score;
      return answers.score;
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* Import ScoreLoader which is the client component that now does the work. */
async function renderScore() {
  const { ScoreLoader } = await import("@/components/score/ScoreLoader");
  render(<ScoreLoader />);
}

describe("/score", () => {
  it("shows the score stored on the record, exactly as served", async () => {
    await renderScore();

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Likeness Health Score 89 out of 100 — low risk" }),
      ).toBeTruthy();
    });
    expect(screen.getByText("89", { selector: "strong" })).toBeTruthy();
  });

  it("shows the account's stored score for a quiz taken on a retired version", async () => {
    answers = {
      me: { ...ME, score: { live: 74, band: "moderate risk", computed_at: "2026-07-01T00:00:00.000Z" } },
      score: QUIZ_OUTDATED,
    };

    await renderScore();

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Likeness Health Score 74 out of 100 — moderate risk" }),
      ).toBeTruthy();
    });
    expect(screen.getByText("74", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
  });
});

describe("/score — the risk factors card", () => {
  it("draws score.risk_factors in the API's order, word for word", async () => {
    await renderScore();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: FACTORS_HEADING })).toBeTruthy();
    });
    expect(rowsOf(card(FACTORS_HEADING))).toStrictEqual(
      RISK_FACTORS.map((factor) => [factor.title, factor.line]),
    );
  });
});

describe("/score — the general recommendations card", () => {
  it("draws general_recommendations in the API's order, word for word", async () => {
    await renderScore();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeTruthy();
    });
    expect(rowsOf(card(RECOMMENDATIONS_HEADING))).toStrictEqual(
      RECOMMENDATIONS.map((recommendation) => [recommendation.title, recommendation.body]),
    );
  });
});
