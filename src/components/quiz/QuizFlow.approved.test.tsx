import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { definitionOf } from "@/lib/analytics.fixtures";
import { writeConsent } from "@/lib/consent";
import { writeFunnel } from "@/lib/funnel-state";
import { QuizFlow } from "./QuizFlow";

/* The live production quiz on screen, with answer analytics approved. */
vi.mock("@/lib/analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: true }));

const nav = vi.hoisted(() => ({ push: vi.fn(), search: "q=3" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/lib/use-quiz-definition", () => ({
  useQuizDefinition: () => ({
    status: "ready",
    quiz: definitionOf("likeness-health-v11"),
    error: null,
    reload: vi.fn(),
  }),
}));

const V = "likeness-health-v11";
const answers = () =>
  ((window as Window & { dataLayer?: { event?: string }[] }).dataLayer ?? [])
    .filter((e) => e.event === "quiz_answer")
    .map((e) => JSON.parse(JSON.stringify(e)));

beforeEach(() => {
  nav.push.mockReset();
  window.sessionStorage.clear();
  writeConsent({ analytics: true, marketing: false });
  vi.stubGlobal("dataLayer", []);
  writeFunnel({ quizVersion: V, answers: { age: "25-34", gender: "Female" } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "imageshield_consent=; Max-Age=0; Path=/";
});

it("sends the final multi-select, in the quiz's order, on Continue", () => {
  nav.search = "q=3";
  render(<QuizFlow signedIn={false} />);
  for (const name of ["TikTok", "Snapchat", "Facebook", "Facebook"]) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(answers()).toStrictEqual([
    { event: "quiz_answer", quiz_version: V, question: "platforms", question_number: 3, answer: "Snapchat|TikTok" },
  ]);
  expect(nav.push).toHaveBeenCalledWith("/quiz/questions?q=4");
});

it("sends a single answer on tap, and none for the gender question", () => {
  nav.search = "q=4";
  render(<QuizFlow signedIn={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
  cleanup();
  nav.search = "q=2";
  render(<QuizFlow signedIn={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Non-Binary" }));
  expect(answers()).toStrictEqual([
    { event: "quiz_answer", quiz_version: V, question: "posting_volume", question_number: 4, answer: "Weekly" },
    { event: "quiz_answer", quiz_version: V, question: "gender", question_number: 2 },
  ]);
});
