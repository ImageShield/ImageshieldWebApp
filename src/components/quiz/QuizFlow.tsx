"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Check } from "@/components/landing/icons";
import { NOT_ELIGIBLE_PATH, nextPath, STEP_PATHS } from "@/lib/funnel";
import {
  readFunnel,
  saveAnswer,
  syncQuizVersion,
  toggleAnswer,
  useFunnel,
} from "@/lib/funnel-state";
import { askedQuestions, declaresMinor } from "@/lib/quiz";
import { useQuizDefinition } from "@/lib/use-quiz-definition";
import { QuizProgress } from "./QuizProgress";
import { QuizSkeleton } from "./QuizSkeleton";

/**
 * The questions come from `GET /v1/quiz`, read without a session.
 *
 * They are asked before the visitor has verified anything, which used to rule that
 * read out and is why this repo carried a hand-copied copy of the questions. The
 * endpoint is answered unauthenticated now, so there is one definition of the quiz and
 * it is the server's. The API still has the final say at submit: it validates keys and
 * values, and a mismatch comes back as a retake rather than a dead end.
 */
export function QuizFlow({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const stored = useFunnel();
  const params = useSearchParams();
  const { status, quiz, error, reload } = useQuizDefinition();

  /* Answers stored against a retired version are answers to different questions, so
     they are dropped rather than shown as ticks beside questions nobody was asked.

     The clearing happens in an effect because it writes to the store, and the store
     is what this component renders from — writing during render would notify
     subscribers mid-render. The render doesn't wait for it: `answers` already ignores
     answers whose version doesn't match, so the first paint is correct and the
     effect only makes the storage agree with it.

     Keyed on the version rather than running once on mount: the definition arrives
     after the first render now, so a mount-only effect would reconcile against
     nothing and leave a stale tab's answers in place. */
  const liveVersion = quiz?.quiz_version;
  useEffect(() => {
    if (liveVersion !== undefined) syncQuizVersion(liveVersion);
  }, [liveVersion]);

  if (status === "loading") {
    /* Deliberately not a spinner, and for the same reason it is not blank: this
       screen has a shape, and the definition only ever supplies the words that go
       in it. A spinner would throw that away and then hand the whole layout back
       at once; the skeleton reserves it, so the questions land in boxes the eye
       has already found. On a fast connection or a cached definition none of this
       is seen at all — `useQuizDefinition` starts `ready` when the tab has it. */
    return <QuizSkeleton />;
  }

  /* Failing HERE, on the first question, is the point. The alternative — rendering
     questions from a bundled copy the server may have moved past — fails at the very
     END, after the visitor has answered everything and verified a phone number. */
  if (status === "failed" || quiz === null) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-5 pt-20 pb-24">
        <p className="text-base text-ink-muted">
          {error ?? "We couldn't load the quiz just now."}
        </p>
        <button
          type="button"
          onClick={reload}
          className="mt-6 flex h-14 w-full max-w-[512px] items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta"
        >
          Try again
        </button>
      </div>
    );
  }

  /* Re-bound after the guard above so the closures below see a non-null definition.
     `pick` is a hoisted function declaration, which TypeScript will not narrow a
     captured binding for — it cannot prove the guard ran first. */
  const definition = quiz;

  const answers =
    stored.quizVersion === definition.quiz_version ? stored.answers : {};

  const asked = askedQuestions(definition, answers);

  /* A definition with nothing to ask is not a state this screen can render its way
     out of, and it should be impossible — but `asked[step - 1]` would be undefined
     and every line below dereferences it. */
  if (asked.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[600px] px-5 pt-20 pb-24">
        <p className="text-base text-ink-muted">
          There are no questions to answer right now. Please try again in a moment.
        </p>
      </div>
    );
  }

  /* 1-based in the URL because it's also what the "(1/6)" label counts. The clamp
     carries real weight again now the gate is back: the list SHRINKS when someone
     steps back and changes `prior_misuse` to the answer that shuts question six, and
     `?q=6` is still in the URL. Without this it would index past the end, and every
     line below dereferences the result. */
  const step = Math.min(
    Math.max(Number(params.get("q")) || 1, 1),
    asked.length,
  );
  const question = asked[step - 1];

  const go = (to: number) => router.push(`${STEP_PATHS["quiz-questions"]}?q=${to}`);

  function back() {
    if (step > 1) go(step - 1);
    else router.push(STEP_PATHS.quiz);
  }

  /**
   * Where the last answer leads.
   *
   * Normally the details form — the questions are asked first precisely so the phone
   * number is asked of someone who has a score waiting for them.
   *
   * `signedIn` is not a shortcut for returning visitors; it exists for one path that
   * would otherwise cost a second code. When a deploy moves the quiz mid-funnel,
   * `/api/quiz` answers 409 and the screens send the visitor back HERE to answer
   * again — and by then the code has already been spent and a session already exists.
   * Routing that visitor to `/details` would text them a fresh code to prove a number
   * they proved a minute ago. They go straight to the write.
   */
  function finish() {
    /* Adults only, and checked BEFORE the signed-in shortcut below — that ordering is
       the point. Someone who has already verified (and been given an adult placeholder
       birth date) still holds a session, so they can retake the quiz, change their
       age to under 18 and finish again; the shortcut would take them straight to
       `/calculating`, past the details and OTP screens that otherwise turn this
       answer away, and submit it as a fresh score.

       Read from the store rather than `answers`: `pick` calls this straight after
       writing the last answer, and the render-time copy doesn't have it yet. */
    if (declaresMinor(readFunnel().answers)) {
      router.push(NOT_ELIGIBLE_PATH);
      return;
    }
    const onwards = signedIn
      ? STEP_PATHS.calculating
      : (nextPath("quiz-questions") ?? STEP_PATHS.landing);
    router.push(onwards);
  }

  function pick(option: string) {
    if (question.multi) {
      toggleAnswer(question.key, option, question.options);
      return;
    }
    /* Counted against the list THIS answer produces, not the one on screen when it
       was tapped. `asked` is a render-time value, so inside this handler it is still
       the previous answers' copy — and answering `prior_misuse` with a trigger is
       exactly the tap that grows it from 5 to 6. Reading `asked.length` here would
       finish the quiz one question early, on the very question that opens the sixth.

       The write still has to happen before the navigation: the next screen renders
       from the store, and routing first would paint it without the answer just
       picked. `saveAnswer` returns the new state, which is that written answer. */
    const next = saveAnswer(question.key, option);
    if (step < askedQuestions(definition, next.answers).length) go(step + 1);
    else finish();
  }

  const given = answers[question.key];
  const chosen = new Set(
    Array.isArray(given) ? given : given ? [given] : [],
  );

  return (
    <>
      {/* The design only draws desktop, where the bar sits 137px under the header.
          That much dead space swallows a phone screen, so it tightens down. */}
      <div className="pt-10 sm:pt-20 lg:pt-[137px]">
        <QuizProgress step={step} total={asked.length} onBack={back} />
      </div>

      <div className="mx-auto w-full max-w-[600px] px-5 pb-24">
        <p className="mt-10 text-[15px] leading-4 font-bold tracking-[4px] text-ink-muted uppercase lg:mt-[70px]">
          Likeness Health Quiz ({step}/{asked.length})
        </p>

        {/* 24/36 Bold in flat black — the funnel's usual heading size and weight,
            in the same black the option labels underneath use. */}
        <h1 className="mt-[16px] text-[24px] leading-9 font-bold text-black">
          {question.prompt}
        </h1>

        {/* 14/21 regular in black at 45% — a qualifier on the question rather
            than copy in its own right. The translucent black is the design's
            own value, and it sits a touch lighter than `ink-faint` would.
            The definition carries no hint field, so this is derived the way the
            deployed web client derives it: multi-select is the only thing a
            question needs explaining about. */}
        {question.multi ? (
          <p className="mt-[9px] text-[14px] leading-[21px] text-black/45">
            Select all that apply
          </p>
        ) : null}

        <div className="mt-[30px] flex flex-col gap-3">
          {question.options.map((option) => {
            const on = chosen.has(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => pick(option)}
                aria-pressed={question.multi ? on : undefined}
                /* Picked rows keep the white fill and the regular weight the design
                   draws — only the border and the label take the brand colour. A
                   tinted fill reads as a disabled row next to the plain ones. The
                   resting label is the export's flat black, not `ink`: these rows
                   are the one place the design sets the label off the body grey. */
                /* The 1.61px outline is an inset shadow, not a border, for two
                   reasons the export makes plain: a border snaps to whole device
                   pixels (1.5px on a 2x screen, 2px on a 1x one — never 1.61),
                   and CSS measures padding inside a border where Figma measures
                   it from the frame edge and lays the stroke over it. The shadow
                   antialiases to its true width and overlays the padding box, so
                   the checkbox lands at 17.6px from the edge, as drawn. */
                className={`flex h-[53.7px] items-center gap-3 rounded-[14px] bg-canvas px-[17.6px] text-left text-[15px] leading-[22.5px] transition-[color,box-shadow] ${
                  on
                    ? "text-brand shadow-[inset_0_0_0_1.61px_var(--color-brand)]"
                    : "text-black shadow-[inset_0_0_0_1.61px_var(--color-line-soft)] hover:shadow-[inset_0_0_0_1.61px_var(--color-brand-soft)]"
                }`}
              >
                {/* "Select all that apply" is the only thing separating a multi
                    question from a single one, so the box is what carries it —
                    single-answer rows advance on tap and never show a checked
                    state to draw. 20px on a 4px radius, per the design. */}
                {question.multi ? (
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded-[4px] transition-[background-color,box-shadow] ${
                      on
                        ? "bg-brand text-ink-inverse"
                        : "shadow-[inset_0_0_0_1.61px_var(--color-line-strong)]"
                    }`}
                  >
                    {on ? <Check className="size-5" /> : null}
                  </span>
                ) : null}
                {option}
              </button>
            );
          })}
        </div>

        {/* Single-answer questions advance on tap, so only the "select all that
            apply" ones need a way to say they're done. The design insets it 24px
            either side of the option column rather than running it to the full
            560 — it's the one control on the screen that isn't a row. */}
        {question.multi ? (
          <button
            type="button"
            disabled={!chosen.size}
            onClick={() =>
              step < asked.length ? go(step + 1) : finish()
            }
            className="mt-8 mx-auto flex h-14 w-full max-w-[512px] items-center justify-center rounded-full bg-brand text-base font-semibold text-ink-inverse transition-colors hover:bg-cta disabled:opacity-40"
          >
            Continue
          </button>
        ) : null}
      </div>
    </>
  );
}
