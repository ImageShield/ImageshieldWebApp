import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import type { QuizDefinition } from "@/lib/quiz";
import { Calculating } from "./Calculating";

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

/* The real `submitAnswers` runs; only the network is stubbed, answering the way
   `/api/quiz` does. */
const fetchMock = vi.fn();
const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

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
  /* /calculating opened by hand, signed in, with an under-18 answer in the tab: the
     screen sends the answers and the API is what refuses them. */
  it("follows an under-18 refusal to /not-eligible", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "Under 18", gender: "Female" } });
    reply(403, { error: "Only 18 and over.", notEligible: true });

    render(<Calculating />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/not-eligible"), settled);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).answers.age).toBe("Under 18");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled(); // never on to the score
    expect(screen.queryByText(/couldn.t finish scoring/i)).toBeNull(); // no retry panel
  });

  it("still goes on to the score for an adult answer", async () => {
    writeFunnel({ quizVersion: "test-v1", answers: { age: "18-24", gender: "Female" } });
    reply(200, { ok: true });

    render(<Calculating />);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/score"), settled);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
