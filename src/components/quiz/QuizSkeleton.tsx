import { Skeleton } from "@/components/Skeleton";

/**
 * The question screen, before the questions arrive.
 *
 * `QuizFlow` renders this while `GET /api/quiz-definition` is in flight. The
 * layout is the same screen's, measurement for measurement - the progress row's
 * 920px track, the 600px column under it, and option rows at the 53.7px the
 * design draws - so the words drop into boxes that are already where they will
 * stay. Both files have to move together; the reasoning behind each number is
 * in `QuizFlow` and `QuizProgress`, beside the real thing.
 *
 * The prompt is reserved at one line and the answers at five rows, which is
 * not an average - it is question one exactly. This only ever shows when the
 * definition is not already in the tab, and `useQuizDefinition` keeps it for
 * the tab's whole life, so what it stands in for is very nearly always the
 * first screen of a fresh visit: a one-line prompt over five options. Averaging
 * the six questions instead would trade an exact fit on the screen this
 * actually appears on for a near fit on five it does not.
 *
 * The progress bar is drawn empty rather than at some invented percentage. It
 * is the one element on the screen whose fill means something, and a bar
 * showing a third when the visitor is on question one would be a small lie
 * told in a loading state.
 */
export function QuizSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading the quiz
      </p>

      <div className="pt-10 sm:pt-20 lg:pt-[137px]">
        {/* `QuizProgress`'s own row: the back chevron, the track, the close
            cross. The two controls are drawn as discs because that is the tap
            target they occupy, and it is what stops the track's ends moving
            when the real glyphs replace them. */}
        <div className="mx-auto flex w-full max-w-[920px] items-center px-5">
          <Skeleton className="-ml-[17px] size-11 shrink-0 rounded-full" />
          <Skeleton className="mr-2 ml-[15px] h-2 flex-1 rounded-full" />
          <Skeleton className="-mr-[14px] size-11 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[600px] px-5 pb-24">
        {/* "LIKENESS HEALTH QUIZ (1/6)" - the tracked uppercase eyebrow. */}
        <Skeleton className="mt-10 h-4 w-[240px] rounded lg:mt-[70px]" />

        {/* The prompt. One line, at a width that reads as a question rather
            than as a full measure of body copy - the real one is 24/36 Bold and
            rarely runs the whole 560. */}
        <Skeleton className="mt-[16px] h-9 w-[62%] rounded-md" />

        <div className="mt-[30px] flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[53.7px] w-full rounded-[14px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
