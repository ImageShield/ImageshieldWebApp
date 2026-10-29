import Link from "next/link";
import { STEP_PATHS } from "@/lib/funnel";

/**
 * What the three numbers are, and where they come from. They are set here rather
 * than in `lib/` because nothing else reads them - they are copy, not data.
 */
const STATS = [
  {
    figure: "1 in 5",
    body: (
      <>
        People say they <em className="italic">know</em> their likeness has been
        abused, so the real incidence is much higher
      </>
    ),
  },
  {
    figure: "50 million",
    body: <>women worldwide are victims of likeness abuse each year</>,
  },
  {
    figure: "1.2 million",
    body: (
      <>
        children reported that their likenesses had been deepfaked in a recent
        study
      </>
    ),
  },
] as const;

/**
 * The quiz pitch, on the one coral card the site has.
 *
 * Off the 1440 frame: a 1379×523 card with a 24px radius, inset 35px from either
 * edge with 26px of white above and below it, 75px of padding in from its own left
 * edge. Inside, two columns - the ask on the left, the three numbers that justify
 * it on the right, the second starting at x 970, which is what the `1fr / 270px`
 * split with a 99px gutter resolves to at the design width.
 *
 * The heading is ExtraBold tracked -1.5px, which at its 48px is the -0.03125em
 * set here - an em rather than the design's px so the 32px phone size is tracked
 * by the same proportion rather than three times as hard.
 *
 * The numbers column is 361px, not the 369 the export measures. The export draws
 * the card at x 35 width 1379 in a 1440 frame - 35px of white on its left and 26 on
 * its right - which is a slip, not a lean, so the card here is symmetric and ends
 * 9px earlier. Taking those 9px off the column instead puts every figure and every
 * line under it back on the x the design sets, which is the half that shows.
 *
 * The card stops growing at the 1370 the design gives it. Past that the band goes
 * on bleeding and the card centres inside it: left to fill a 1920 monitor, the
 * `1fr` column would open a 700px hole between the ask and the numbers that are
 * supposed to be answering it.
 *
 * The two columns do not share a top edge: the left one starts 117px down and the
 * right one 96px, so they are separate blocks with their own padding rather than
 * rows of one grid. Stacked under `lg` that difference disappears, which is the
 * right answer there - a figure and the sentence it belongs to read as one block.
 */
export function ScoreBanner() {
  return (
    <section className="bg-canvas px-5 py-6 lg:px-[35px] lg:py-[26px]">
      <div className="mx-auto grid max-w-[1370px] gap-12 rounded-3xl bg-coral px-6 py-12 lg:grid-cols-[minmax(0,1fr)_361px] lg:gap-y-0 lg:px-[75px] lg:pt-0 lg:pb-0">
        <div className="lg:pt-[104px] lg:pb-[98px]">
          <h2 className="max-w-[520px] text-[2rem] leading-[2.5rem] font-extrabold tracking-[-0.03125em] text-white lg:text-5xl lg:leading-[60px]">
            What is your Likeness Health Score
            {/* Service mark: 16px of cap height against the headline's 36, its cap
                line 2px under the headline's, which is `0.445em` raised `0.79em` of
                its OWN size. Raised by `top` against an explicit `align-baseline`,
                not by `vertical-align` - `sup` arrives carrying the UA sheet's
                `vertical-align: super`, and a super that Chrome scales with the
                font size is the thing that moves when you resize the mark.

                The design keeps the mark on the same line as the question mark, so
                neither is allowed to wrap away from "Score". Both drop a step to
                Bold: the words around them are ExtraBold, and a mark set at the
                weight of the word it marks reads as part of it. */}
            <sup className="relative -top-[0.79em] ml-[0.05em] align-baseline text-[0.445em] leading-none font-bold">
              SM
            </sup>
            <span className="ml-[0.04em] font-bold">?</span>
          </h2>

          <p className="mt-3 max-w-[520px] text-lg leading-7 font-medium text-white lg:mt-[15px] lg:text-xl lg:leading-[30px]">
            Are you in danger of having your likeness stolen, deepfaked, or
            otherwise misused?
            <br />
            <span className="font-bold">
              Take our 1-minute quiz to find out.
            </span>
          </p>

          <Link
            href={STEP_PATHS.quiz}
            className="mt-8 flex h-[60px] w-48 items-center justify-center rounded-full bg-white text-xl leading-6 font-semibold text-ink-soft transition-colors hover:bg-canvas-tint lg:mt-[36px]"
          >
            Take the Quiz
          </Link>
        </div>

        <dl className="flex flex-col gap-8 lg:gap-7 lg:pt-[86px]">
          {STATS.map((stat) => (
            <div key={stat.figure}>
              <dt className="text-[28px] leading-[42px] font-extrabold text-white">
                {stat.figure}
              </dt>
              <dd className="mt-1 max-w-[270px] text-base leading-5 font-medium text-white">
                {stat.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
