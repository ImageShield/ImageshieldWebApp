import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import type { QuizDefinition } from "@/lib/quiz";
import { Calculating } from "./Calculating";

/* The full-page hop to /not-eligible, recorded rather than performed (jsdom can't navigate). */
const leave = vi.hoisted(() => vi.fn());
vi.mock("@/lib/not-eligible", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/not-eligible")>()),
  leaveForNotEligible: leave,
}));
beforeEach(() => {
  leave.mockReset();
  window.sessionStorage.removeItem("imageshield.under18");
});

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));

const QUIZ: QuizDefinition = {
  quiz_version: "test-v1",
  questions: [
    { key: "age", prompt: "What is your age?", options: ["Under 18", "18-24"] },
    { key: "gender", prompt: "What is your gender?", options: ["Female", "Male"] },
  ],
};
vi.mock("@/lib/use-quiz-definition", () => ({
  useQuizDefinition: () => ({ quiz: QUIZ, error: null, reload: vi.fn() }),
}));

vi.mock("@/lib/browser-session", () => ({
  hasSession: vi.fn(() => true),
  isAccessExpired: vi.fn(() => false),
  accessToken: vi.fn(() => "test-token"),
  refreshToken: vi.fn(() => "test-refresh"),
  adoptTokens: vi.fn(),
  clearSession: vi.fn(),
}));

/**
 * Mock fetch that routes by URL path.
 *
 * `submitAnswers` now calls the backend directly through multiple endpoints:
 *   1. GET /v1/me/score - to check if a score already exists
 *   2. GET /v1/quiz - to read the live definition for answer validation
 *   3. POST /v1/quiz/responses - to submit the answers
 */
const fetchMock = vi.fn();

function setupApiMocks(opts: { scoreStatus?: number; quizDef?: unknown; submitStatus?: number; submitBody?: unknown }) {
  fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    const method = init?.method ?? "GET";

    if (method === "GET" && urlStr.includes("/v1/me/score")) {
      if (opts.scoreStatus === 200) {
        return new Response(JSON.stringify({ score: { live: 42 } }), { status: 200 });
      }
      // Default: no score yet (404 NO_QUIZ_RESPONSE)
      return new Response(
        JSON.stringify({ error: "NO_QUIZ_RESPONSE", message: "no quiz response yet" }),
        { status: 404 },
      );
    }

    if (method === "GET" && urlStr.includes("/v1/me") && !urlStr.includes("/v1/me/")) {
      // Fallback for /v1/me (used in hasScoreOnRecord when 404)
      return new Response(JSON.stringify({ score: null }), { status: 200 });
    }

    if (method === "GET" && urlStr.includes("/v1/quiz")) {
      return new Response(JSON.stringify(opts.quizDef ?? QUIZ), { status: 200 });
    }

    if (method === "POST" && urlStr.includes("/v1/quiz/responses")) {
      return new Response(
        JSON.stringify(opts.submitBody ?? { ok: true }),
        { status: opts.submitStatus ?? 200 },
      );
    }

    return new Response(JSON.stringify({ error: "NOT_FOUND", message: "unexpected" }), { status: 404 });
  });
}

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* The write holds for a 1.2s floor before it applies, hence the longer wait. */
const settled = { timeout: 3000 };

describe("Calculating", () => {
  /* /calculating opened by hand, signed in, with an under-18 answer in the tab:
     `submitAnswers` catches it client-side via `declaresMinor()` and returns
     not-eligible, which the Calculating screen redirects to /not-eligible. */
  it("follows an under-18 refusal to /not-eligible", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "Under 18", gender: "Female" } });
    setupApiMocks({});

    render(<Calculating />);

    await waitFor(() => expect(leave).toHaveBeenCalledWith("replace"), settled);
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByText(/couldn.t finish scoring/i)).toBeNull();
  });

  it("still goes on to the score for an adult answer", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "18-24", gender: "Female" } });
    setupApiMocks({});

    render(<Calculating />);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/score"), settled);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
