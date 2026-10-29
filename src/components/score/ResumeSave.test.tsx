import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import type { QuizDefinition } from "@/lib/quiz";
import { ResumeSave } from "./ResumeSave";

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

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
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
      return new Response(
        JSON.stringify({ error: "NO_QUIZ_RESPONSE", message: "no quiz response yet" }),
        { status: 404 },
      );
    }

    if (method === "GET" && urlStr.includes("/v1/me") && !urlStr.includes("/v1/me/")) {
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
  nav.refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResumeSave", () => {
  it("follows an under-18 refusal to /not-eligible, off the save screen", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "Under 18", gender: "Female" } });
    setupApiMocks({});

    render(<ResumeSave />);

    await waitFor(() => expect(leave).toHaveBeenCalledWith("replace"));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/couldn.t finish scoring/i)).toBeNull();
  });

  it("still re-reads the score after an adult save", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "18-24", gender: "Female" } });
    setupApiMocks({});

    render(<ResumeSave />);

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
