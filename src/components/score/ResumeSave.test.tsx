import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import type { QuizDefinition } from "@/lib/quiz";
import { ResumeSave } from "./ResumeSave";

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

/* The real `submitAnswers` runs; only the network is stubbed, answering the way
   `/api/quiz` does. */
const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

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
    reply(403, { error: "Only 18 and over.", notEligible: true });

    render(<ResumeSave />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/not-eligible"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nav.refresh).not.toHaveBeenCalled(); // no score read back
    expect(screen.queryByText(/couldn.t finish scoring/i)).toBeNull(); // not stuck on "Try again"
  });

  it("still re-reads the score after an adult save", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "18-24", gender: "Female" } });
    reply(200, { ok: true });

    render(<ResumeSave />);

    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
