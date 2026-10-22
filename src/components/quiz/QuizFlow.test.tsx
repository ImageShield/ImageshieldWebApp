import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConsent } from "@/lib/consent";
import { writeFunnel } from "@/lib/funnel-state";
import type { QuizDefinition } from "@/lib/quiz";
import { QuizFlow } from "./QuizFlow";

const nav = vi.hoisted(() => ({ push: vi.fn(), search: "q=2" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const quiz = vi.hoisted(() => ({ current: null as QuizDefinition | null }));
vi.mock("@/lib/use-quiz-definition", () => ({
  useQuizDefinition: () => ({
    status: "ready",
    quiz: quiz.current,
    error: null,
    reload: vi.fn(),
  }),
}));

const AGE = {
  key: "age",
  prompt: "What is your age?",
  options: ["Under 18", "18-24", "25-34"],
};

/* Age first, as live; the last question is what calls `finish()`. */
const SINGLE_LAST: QuizDefinition = {
  quiz_version: "test-v1",
  questions: [AGE, { key: "gender", prompt: "What is your gender?", options: ["Female", "Male"] }],
};
const MULTI_LAST: QuizDefinition = {
  quiz_version: "test-v1",
  questions: [
    AGE,
    {
      key: "platforms",
      prompt: "Which platforms do you use?",
      options: ["TikTok", "Instagram"],
      multi: true,
    },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  nav.push.mockReset();
  nav.search = "q=2";
  quiz.current = SINGLE_LAST;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Answers the age question earlier in the run, then the last question. */
function finishWithAge(age: string, signedIn: boolean) {
  writeFunnel({ quizVersion: quiz.current!.quiz_version, answers: { age } });
  render(<QuizFlow signedIn={signedIn} />);
  if (quiz.current === MULTI_LAST) {
    fireEvent.click(screen.getByRole("button", { name: "TikTok" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  } else {
    fireEvent.click(screen.getByRole("button", { name: "Female" }));
  }
}

const destinations = () => nav.push.mock.calls.map(([path]) => path);

describe("QuizFlow finishing the quiz", () => {
  describe("with an under-18 answer", () => {
    it("sends a signed-out visitor to /not-eligible", () => {
      finishWithAge("Under 18", false);
      expect(destinations()).toStrictEqual(["/not-eligible"]);
    });

    /* The bypass this closes: a session sends a finished quiz straight to
       /calculating, past the details and OTP screens' own under-18 checks. */
    it("sends a signed-in visitor to /not-eligible, not the signed-in shortcut", () => {
      finishWithAge("Under 18", true);
      expect(destinations()).toStrictEqual(["/not-eligible"]);
    });

    it("never reaches /calculating, so no score is submitted", () => {
      finishWithAge("Under 18", true);
      expect(destinations()).not.toContain("/calculating");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("is checked on the multi-select Continue path too", () => {
      quiz.current = MULTI_LAST;
      finishWithAge("Under 18", true);
      expect(destinations()).toStrictEqual(["/not-eligible"]);
    });

    it("catches the dev fixture's 13-17 band as well", () => {
      finishWithAge("13-17", true);
      expect(destinations()).toStrictEqual(["/not-eligible"]);
    });

    /* `pick` writes the answer and calls `finish()` in the same handler, before a
       re-render — so the check has to read the store, not the render-time answers. */
    it("sees the answer just picked when age is the last question", () => {
      quiz.current = { quiz_version: "test-v1", questions: [AGE] };
      nav.search = "q=1";
      writeFunnel({ quizVersion: "test-v1", answers: {} });
      render(<QuizFlow signedIn />);
      fireEvent.click(screen.getByRole("button", { name: "Under 18" }));
      expect(destinations()).toStrictEqual(["/not-eligible"]);
    });
  });

  describe("with an adult answer", () => {
    it("keeps the signed-in shortcut to /calculating", () => {
      finishWithAge("18-24", true);
      expect(destinations()).toStrictEqual(["/calculating"]);
    });

    it("keeps sending a signed-out visitor to /details", () => {
      finishWithAge("18-24", false);
      expect(destinations()).toStrictEqual(["/details"]);
    });
  });
});

describe("QuizFlow Tag Manager events", () => {
  /* Cleared (undefined) fields left out, as JSON would — see analytics.test.ts. */
  const pushed = () => {
    const raw = (window as Window & { dataLayer?: object[] }).dataLayer;
    return raw && (JSON.parse(JSON.stringify(raw.filter((e) => "event" in e))) as unknown[]);
  };
  const v = "test-v1";
  const start = (question_number: number) => ({ event: "quiz_start", quiz_version: v, question_number });
  const answer = (question: string, question_number: number) => ({
    event: "quiz_answer",
    quiz_version: v,
    question,
    question_number,
  });
  const complete = { event: "quiz_complete", quiz_version: v, question_count: 2 };

  beforeEach(() => {
    window.sessionStorage.removeItem("imageshield.analytics.v1");
    writeConsent({ analytics: true, marketing: false });
    vi.stubGlobal("dataLayer", []);
  });

  afterEach(() => {
    document.cookie = "imageshield_consent=; Max-Age=0; Path=/";
  });

  it("starts on the first question shown, then the answer, then completion", () => {
    finishWithAge("18-24", false);
    expect(pushed()).toStrictEqual([start(2), answer("gender", 2), complete]);
  });

  it("starts once, on the first question, however many questions follow", () => {
    nav.search = "q=1";
    writeFunnel({ quizVersion: v, answers: {} });
    const { rerender } = render(<QuizFlow signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "25-34" }));
    nav.search = "q=2";
    rerender(<QuizFlow signedIn={false} />);
    rerender(<QuizFlow signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Female" }));
    expect(pushed()).toStrictEqual([start(1), answer("age", 1), answer("gender", 2), complete]);
  });

  it("pushes a multi-select once, on Continue, not on each tick", () => {
    quiz.current = MULTI_LAST;
    writeFunnel({ quizVersion: v, answers: { age: "18-24" } });
    render(<QuizFlow signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "TikTok" }));
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "TikTok" }));
    expect(pushed()).toStrictEqual([start(2)]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(pushed()).toStrictEqual([start(2), answer("platforms", 2), complete]);
  });

  /* `test-v1` isn't a reviewed version, and answer analytics isn't approved: no
     answer value can leave, whichever question it is. */
  it("never carries an answer value", () => {
    nav.search = "q=1";
    writeFunnel({ quizVersion: v, answers: {} });
    const { unmount } = render(<QuizFlow signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "25-34" }));
    unmount();
    nav.search = "q=2";
    finishWithAge("25-34", false);
    expect(pushed()).toHaveLength(4);
    const sent = JSON.stringify(pushed());
    for (const leak of ["25-34", "Female", '"answer"']) expect(sent).not.toContain(leak);
  });

  /* Back to a question already answered, and answered differently; then a refresh. */
  it("counts a revisited question, and a reloaded screen, once", () => {
    finishWithAge("18-24", false);
    cleanup();
    finishWithAge("18-24", false);
    expect(pushed()).toStrictEqual([start(2), answer("gender", 2), complete]);
    expect(destinations()).toStrictEqual(["/details", "/details"]);
  });

  it("sends nothing for an under-18 finisher, and still turns them away", () => {
    finishWithAge("Under 18", false);
    expect(pushed()).toStrictEqual([]);
    expect(destinations()).toStrictEqual(["/not-eligible"]);
  });

  it("runs the quiz the same with analytics rejected", () => {
    writeConsent({ analytics: false, marketing: false });
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", fetchMock);
    finishWithAge("18-24", false);
    expect(pushed()).toBeUndefined();
    expect(destinations()).toStrictEqual(["/details"]);
  });

  it("runs the quiz the same once analytics is withdrawn mid-quiz", () => {
    nav.search = "q=1";
    writeFunnel({ quizVersion: v, answers: {} });
    const { unmount } = render(<QuizFlow signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "25-34" }));
    unmount();
    writeConsent({ analytics: false, marketing: false });
    nav.search = "q=2";
    finishWithAge("25-34", false);
    expect(pushed()).toStrictEqual([start(1), answer("age", 1)]);
    expect(destinations()).toStrictEqual(["/quiz/questions?q=2", "/details"]);
  });
});
