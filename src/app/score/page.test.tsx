import { cleanup, render, screen, within } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneralRecommendation } from "@/lib/recommendations";
import type { RiskFactor, ScoreEnvelope } from "@/lib/score";
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
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

/* Placeholder strings, not copy. Ordered so that neither sorting by points (4, 9, 6)
   nor by title would reproduce it — the screen must keep the API's order as served.
   No digits anywhere, so a `points` value leaking onto the card is easy to spot. */
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

/* One of each link shape the contract allows: labelled, unlabelled, none. */
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
    risk_factors: RISK_FACTORS,
  },
  scope_note: "Computed from your quiz, photos and coverage.",
  general_recommendations: RECOMMENDATIONS,
};

const FACTORS_HEADING = "The primary risk factors that determined your initial score";
const RECOMMENDATIONS_HEADING = "General recommendations";

/** The card under a heading, for asserting inside it alone. */
const card = (heading: string) =>
  screen.getByRole("heading", { name: heading, level: 2 }).closest("section")!;

/** Each row of a card as [title, body], in the order drawn. */
const rowsOf = (section: HTMLElement) =>
  within(section)
    .getAllByRole("listitem")
    .map((row) => [row.querySelector("h3")!.textContent, row.querySelector("p")!.textContent]);

/* A line from each of the cards' old hardcoded copy. None may ever come back. */
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

/** The envelope as prod answers today: neither `risk_factors` nor
 *  `general_recommendations` sent yet. */
function withoutInsights(envelope: ScoreEnvelope): ScoreEnvelope {
  const bare = structuredClone(envelope);
  delete bare.general_recommendations;
  if (bare.score) delete bare.score.risk_factors;
  return bare;
}

/* A visitor scored on the quiz the v17 evidence report covers, from an API that
   doesn't send either card yet. The answers are the record's own, in its breakdown. */
const V17: ScoreEnvelope = withoutInsights({
  ...STORED,
  score: {
    ...STORED.score!,
    live: 67,
    band: "moderate risk",
    scoring_version: "likeness-score-v17",
    quiz_version: "likeness-health-v17",
    breakdown: {
      quiz: [
        { key: "age", value: "18-24", deduction: 6, type: "demographic" },
        { key: "gender", value: "Female", deduction: 6, type: "demographic" },
        { key: "platforms", value: ["X (Twitter)", "Instagram"], deduction: 8, type: "exposure" },
        { key: "prior_misuse", value: "No known incidents", deduction: 0, type: "history" },
        { key: "posting_volume", value: "Weekly", deduction: 5, type: "exposure" },
        {
          key: "q_il8uju",
          value: "I don’t have a way to monitor my likeness",
          deduction: 8,
          type: "history",
        },
      ],
      dynamic: [],
      escrow: { next_milestone_days: null },
    },
  },
});

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
const NO_QUIZ_RESPONSE = new ApiFailure(404, "NO_QUIZ_RESPONSE", "no quiz response yet", null, null);

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
    // /v1/me carries neither list, so neither card — not an empty one, not old copy.
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
  });

  it("still sends a retired quiz to be retaken when the account has no score", async () => {
    answers = { me: { ...ME, score: null }, score: QUIZ_OUTDATED };

    await ScorePage();

    expect(redirect).toHaveBeenCalledWith("/quiz/questions");
  });

  /* /v1/me carries a score while /v1/me/score has no response for it. Rendering the
     resume here would post this tab's answers over that score, so the stored one is
     shown instead — the same answer `/api/quiz` gives. */
  it("shows the account's stored score when /v1/me/score has no response for it", async () => {
    answers = {
      me: { ...ME, score: { live: 81, band: "low risk", computed_at: "2026-09-12T00:00:00.000Z" } },
      score: NO_QUIZ_RESPONSE,
    };

    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 81 out of 100 — low risk" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Finishing your Likeness Health Score/)).toBeNull();
  });

  it("still resumes the write for an account with no score anywhere", async () => {
    answers = { me: { ...ME, score: null }, score: NO_QUIZ_RESPONSE };

    render(await ScorePage());

    expect(screen.getByText(/Finishing your Likeness Health Score/)).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Likeness Health Score \d+ out of 100/ })).toBeNull();
  });
});

describe("/score — the risk factors card", () => {
  it("draws score.risk_factors in the API's order, word for word", async () => {
    render(await ScorePage());

    expect(rowsOf(card(FACTORS_HEADING))).toStrictEqual(
      RISK_FACTORS.map((factor) => [factor.title, factor.line]),
    );
  });

  it("does not show what each factor took off the score", async () => {
    render(await ScorePage());

    expect(card(FACTORS_HEADING).textContent).not.toMatch(/\d/);
  });

  it("hides the whole card, heading included, when the API sends an empty list", async () => {
    answers.score = { ...STORED, score: { ...STORED.score!, risk_factors: [] } };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expectNoRetiredCopy();
    // The other card is decided on its own list.
    expect(card(RECOMMENDATIONS_HEADING)).toBeTruthy();
  });
});

describe("/score — the general recommendations card", () => {
  it("draws general_recommendations in the API's order, word for word", async () => {
    render(await ScorePage());

    expect(rowsOf(card(RECOMMENDATIONS_HEADING))).toStrictEqual(
      RECOMMENDATIONS.map((recommendation) => [recommendation.title, recommendation.body]),
    );
  });

  it("opens a labelled link in a new tab, by its own label", async () => {
    render(await ScorePage());

    const link = within(card(RECOMMENDATIONS_HEADING)).getByRole("link", {
      name: "Read the guide (opens in a new tab)",
    });
    expect(link.getAttribute("href")).toBe("https://example.org/guide");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("names an unlabelled link by the page's host", async () => {
    render(await ScorePage());

    const link = within(card(RECOMMENDATIONS_HEADING)).getByRole("link", {
      name: "example.com (opens in a new tab)",
    });
    expect(link.getAttribute("href")).toBe("https://www.example.com/research/privacy");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("draws no link for a recommendation without one", async () => {
    render(await ScorePage());

    const rows = within(card(RECOMMENDATIONS_HEADING)).getAllByRole("listitem");
    expect(rows.map((row) => within(row).queryAllByRole("link").length)).toStrictEqual([1, 1, 0]);
  });

  it("hides the whole card, heading included, when the API sends an empty list", async () => {
    answers.score = { ...STORED, general_recommendations: [] };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
    expect(card(FACTORS_HEADING)).toBeTruthy();
  });
});

describe("/score — with neither list", () => {
  it("shows the score and neither card when both lists are empty", async () => {
    answers.score = {
      ...STORED,
      score: { ...STORED.score!, risk_factors: [] },
      general_recommendations: [],
    };

    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 89 out of 100 — low risk" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
  });

  it("shows neither card when the API omits both fields", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = withoutInsights(STORED);

    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 89 out of 100 — low risk" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
    warn.mockRestore();
  });
});

describe("/score — when the API omits both fields", () => {
  it("hides both cards and still shows the score", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = V17;

    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 67 out of 100 — moderate risk" }),
    ).toBeTruthy();
    expect(screen.getByText("67", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
    warn.mockRestore();
  });
});

/* What prod scores today: likeness-health-v11, by v11's own (unpublished) rules,
   from an API that sends neither card. The breakdown shape is the one the v17 path
   reads — a live v11 response hasn't been captured to confirm it, and the scoring
   version string is a placeholder the engine doesn't depend on. */
const V11: ScoreEnvelope = withoutInsights({
  ...STORED,
  score: {
    ...STORED.score!,
    live: 64,
    band: "moderate risk",
    quiz_version: "likeness-health-v11",
    scoring_version: "likeness-score-v11",
    breakdown: {
      quiz: [
        { key: "age", value: "18-24", deduction: 6, type: "demographic" },
        { key: "gender", value: "Female", deduction: 6, type: "demographic" },
        { key: "platforms", value: ["X (Twitter)", "Instagram"], deduction: 8, type: "exposure" },
        { key: "posting_volume", value: "Weekly", deduction: 5, type: "exposure" },
        { key: "prior_misuse", value: "No known incidents", deduction: 0, type: "history" },
        {
          key: "discovery_method",
          value: "I don’t have a way to monitor my likeness",
          deduction: 8,
          type: "history",
        },
      ],
      dynamic: [],
      escrow: { next_milestone_days: null },
    },
  },
});

describe("/score — a prod (v11) record without API-served cards", () => {
  it("hides both cards when the API omits risk_factors and general_recommendations", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = V11;

    render(await ScorePage());

    expect(
      screen.getByRole("img", { name: "Likeness Health Score 64 out of 100 — moderate risk" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    expectNoRetiredCopy();
    warn.mockRestore();
  });
});

/* The backend is the sole source for both cards — no local fallback. */
describe("/score — the backend is the sole source for both cards", () => {
  const API_FACTOR_ROWS = RISK_FACTORS.map((factor) => [factor.title, factor.line]);
  const API_RECOMMENDATION_ROWS = RECOMMENDATIONS.map((r) => [r.title, r.body]);

  it("uses the API's lists when they have entries", async () => {
    answers.score = {
      ...V11,
      score: { ...V11.score!, risk_factors: RISK_FACTORS },
      general_recommendations: RECOMMENDATIONS,
    };

    render(await ScorePage());

    expect(rowsOf(card(FACTORS_HEADING))).toStrictEqual(API_FACTOR_ROWS);
    expect(rowsOf(card(RECOMMENDATIONS_HEADING))).toStrictEqual(API_RECOMMENDATION_ROWS);
  });

  it("hides both cards when the API sends empty lists", async () => {
    answers.score = { ...V11, score: { ...V11.score!, risk_factors: [] }, general_recommendations: [] };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
  });

  it("hides both cards when the API sends null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = {
      ...V11,
      score: { ...V11.score!, risk_factors: null as unknown as RiskFactor[] },
      general_recommendations: null as unknown as GeneralRecommendation[],
    };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    warn.mockRestore();
  });

  it("hides both cards when the API leaves the fields out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = V11;

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
    warn.mockRestore();
  });

  it("shows the API's factors and hides recommendations when that list is empty", async () => {
    answers.score = {
      ...V11,
      score: { ...V11.score!, risk_factors: RISK_FACTORS },
      general_recommendations: [],
    };

    render(await ScorePage());

    expect(rowsOf(card(FACTORS_HEADING))).toStrictEqual(API_FACTOR_ROWS);
    expect(screen.queryByRole("heading", { name: RECOMMENDATIONS_HEADING })).toBeNull();
  });

  it("shows the API's recommendations and hides factors when that list is empty", async () => {
    answers.score = {
      ...V11,
      score: { ...V11.score!, risk_factors: [] },
      general_recommendations: RECOMMENDATIONS,
    };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(rowsOf(card(RECOMMENDATIONS_HEADING))).toStrictEqual(API_RECOMMENDATION_ROWS);
  });

  it("treats a field that isn't a list as malformed and hides that card", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answers.score = {
      ...V11,
      score: { ...V11.score!, risk_factors: "pending" as unknown as RiskFactor[] },
      general_recommendations: RECOMMENDATIONS,
    };

    render(await ScorePage());

    expect(screen.queryByRole("heading", { name: FACTORS_HEADING })).toBeNull();
    expect(rowsOf(card(RECOMMENDATIONS_HEADING))).toStrictEqual(API_RECOMMENDATION_ROWS);
    expect(String(warn.mock.calls[0][0])).toMatch(/risk_factors is not a list/);
    warn.mockRestore();
  });
});

