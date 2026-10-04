import { SiteHeader } from "@/components/landing/SiteHeader";
import type { Handoff } from "@/lib/handoff";
import type { Recommendation } from "@/lib/recommendations";
import {
  bandLabel,
  type FactorIcon,
  reportFactors,
  type RiskLevel,
  riskLevelOf,
  type ScoreRecord,
} from "@/lib/score";
import { Calendar, Eye, Globe, Report, ShieldCheck, Venus, Wand } from "../funnel/icons";
import { AppHandoffSection } from "./AppHandoffSection";
import { DownloadPrompt } from "./DownloadPrompt";
import { InsightCard, type InsightRow } from "./InsightCard";
import { ScoreGauge } from "./ScoreGauge";
import { ScoreScale } from "./ScoreScale";
import { ShareScoreButton } from "./ShareScoreButton";

/**
 * The accent colour on the risk word, per band.
 *
 * Written out rather than built as `text-risk-${level}` — Tailwind scans source for
 * whole class names, and an interpolated one is never generated.
 */
const RISK_WORD: Record<RiskLevel, string> = {
  high: "text-risk-high",
  moderate: "text-risk-moderate",
  low: "text-risk-low",
};

const FACTOR_ICONS: Record<FactorIcon, (props: { className?: string }) => React.ReactElement> = {
  calendar: Calendar,
  venus: Venus,
  globe: Globe,
  eye: Eye,
  report: Report,
  shield: ShieldCheck,
  wand: Wand,
};

/**
 * The warm card both download prompts sit in — its shape, padding and ground.
 * Exported so the loading skeleton paints the same card rather than a copy of it.
 *
 * The ground on a phone is two gradients, as the mobile export draws them: the
 * desktop's horizontal cream wash with a vertical amber→red overlay laid over it.
 * That overlay runs from the card's top edge to y=1151 on a card that ends at y=964,
 * so only its first 61% is ever seen — the end stop here is that gradient sampled at
 * 61%, not its own final stop, which would land a far redder card than the export
 * shows.
 */
export const WARM_CARD =
  "rounded-3xl px-5 pt-5 pb-[25px] sm:px-8 sm:py-10 bg-[linear-gradient(180deg,rgba(246,182,11,0.11)_0%,rgba(239,101,34,0.287)_100%),linear-gradient(90deg,#F7F3F0_0%,#EFE8E4_100%)] sm:bg-[linear-gradient(90deg,#F7F3F0_0%,#EFE8E4_100%)]";

/**
 * The result screen, laid out from the LHS Results V1 export.
 *
 * Everything above the fold comes off the stored record; the two cards under it are
 * the record plus copy. The order is the export's, and it is an argument: the number
 * and what it means, then the one action that follows from it, then why the number is
 * what it is, then what to do about it, then the app.
 *
 * The phone export reorders the top of that argument and nothing else. On a desktop
 * the gauge sits BESIDE the headline, so the sentence under the headline is read
 * before the eye reaches the arc; on a phone the gauge sits UNDER the headline, and
 * the same sentence placed under the headline would separate the two. So the
 * sentence moves below the gauge and its scale — the number is shown, then explained.
 * `order` does that below `lg`; at `lg` the section becomes a two-column grid whose
 * explicit placement ignores `order` and restores the export's own arrangement.
 *
 * `prompts` maps a breakdown key to the question it was asked as, from the same quiz
 * definition the visitor answered. It is only a fallback: a factor the presentation
 * table recognises gets the written copy, and one it doesn't gets the real question
 * instead of a slug like `content_type`.
 *
 * `recommendations` is passed in rather than imported so that the day the API serves
 * them, the page changes and this screen does not. See `lib/recommendations.ts`.
 */
export function ScoreResult({
  record,
  handoff,
  prompts,
  recommendations,
}: {
  record: ScoreRecord;
  handoff: Handoff;
  prompts?: ReadonlyMap<string, string>;
  recommendations: readonly Recommendation[];
}) {
  const { score } = record;
  const level = riskLevelOf(score);
  /* The band the API served, rendered as it came. Not derived from the number: the
     API owns the thresholds and says so, and this screen's drawn scale deliberately
     doesn't match them (see ../../lib/score.ts). */
  const label = bandLabel(score);

  const factorRows: InsightRow[] = reportFactors(score.breakdown.quiz, prompts).map(
    (factor) => ({
      id: factor.key,
      icon: FACTOR_ICONS[factor.icon],
      title: factor.title,
      body: factor.description,
    }),
  );

  return (
    /* Plus Jakarta Sans, not the marketing site's Inter. This screen is the last
       one of the funnel rather than the first one of the site, and it is what a
       lead sees immediately before the app — which is drawn in this face too. The
       LHS Results V1 export is set in it, weight for weight. */
    <main className="relative min-h-[100dvh] bg-canvas font-sans">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[958px] px-5 pt-[65px] sm:px-6">
        <p className="mt-[29px] text-center text-[16px] leading-[40px] font-bold text-ink-report sm:mt-12 sm:text-left sm:text-2xl sm:tracking-[-1px] lg:mt-[79px]">
          Your Likeness Health Report
          <sup className="align-[4px] text-[0.42em] lg:align-[6px]">SM</sup>
        </p>

        {/* Below `lg` this is a column and `order` runs it; at `lg` it is a grid and
            the explicit row/column placement takes over. The gauge holds its drawn
            width in both — an arc that reflows with the column drags its printed
            scale out of step with it. The phone's own treatments (centred copy, the
            arc's caption, the smaller scale) end at `sm`, one breakpoint sooner than
            the stacking does: they are answers to a 403px measure, not to a single
            column, and a 700px tablet is a single column with room to spare. */}
        <section className="mt-[15px] flex flex-col sm:mt-10 lg:mt-[37px] lg:grid lg:grid-cols-[1fr_333px] lg:items-start lg:gap-x-10">
          {/* Capped at the export's own measure so it breaks after "risk of",
              not mid-phrase — the line the accent word lands on is the point. */}
          <h1 className="order-1 text-center text-[28px] leading-[1.2] font-bold tracking-[-0.5px] text-ink-report sm:text-left sm:text-[32px] sm:leading-[1.5] lg:col-start-1 lg:row-start-1 lg:max-w-[440px] lg:pt-2 lg:text-[40px] lg:leading-[60px]">
            {record.firstName}, your risk of likeness abuse is{" "}
            {/* One weight heavier than the sentence it ends, not just a colour —
                the export sets the risk word in ExtraBold. The closing mark is
                inside the span rather than after it: it belongs to the word, so it
                takes the band's colour and weight with it.

                An exclamation for the high-risk colour only (the API's "high" and
                "severe" bands); a moderate or low result is stated, not exclaimed. */}
            <span className={`font-extrabold ${RISK_WORD[level]}`}>
              {label}
              {level === "high" ? "!" : "."}
            </span>
          </h1>

          <div className="order-2 mx-auto mt-9 w-full max-w-[333px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
            {/* Only the phone labels the arc. On a desktop it sits beside a headline
                that has just named the score, close enough to need no caption; on a
                phone the headline is a screen-width block above it and the arc reads
                as an unlabelled dial without this. */}
            {/* The share button sits beside the caption, as it sits beside the title
                on the app's score card. A three-column grid keeps the caption itself
                centred, and the button's negative margin keeps its 44px target from
                making the row any taller than the caption's own line. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center sm:hidden">
              <p className="col-start-2 text-center text-base leading-6 text-ink-soft">
                Your Likeness Health Score
                <sup className="align-[3px] text-[0.45em]">SM</sup>
              </p>
              <ShareScoreButton
                score={score.live}
                band={score.band}
                className="-my-2.5 justify-self-start"
              />
            </div>
            <div className="relative mx-auto mt-6 w-[191px] lg:mt-0">
              <ScoreGauge score={score.live} level={level} band={score.band} />
              {/* With no caption above the arc on a wider screen, the button sits
                  off the gauge's top-right corner instead — in the column's spare
                  width beside the arc, positioned so it moves nothing. Both
                  instances share one poster fetch. */}
              <div className="absolute top-0 left-full ml-3 max-sm:hidden">
                <ShareScoreButton score={score.live} band={score.band} />
              </div>
            </div>
            <div className="mt-5 sm:mt-8">
              <ScoreScale />
            </div>
          </div>

          <div className="order-3 mt-[41px] lg:col-start-1 lg:row-start-2 lg:mt-5">
            <p className="text-center text-[14px] leading-[1.5] text-ink-report sm:text-left sm:text-[15px] lg:max-w-[520px]">
              A Likeness Health Score of{" "}
              {/* The figure is marked up as the emphasis it is, and the weight
                  follows the export on each side: the desktop one sets this span at
                  700 against the sentence's 400, and the phone one sets the whole
                  sentence — risk word and figure alike — flat at 400. On a
                  403px measure a bolded number mid-sentence reads as a second
                  headline under the one already above it. */}
              <strong className="font-normal sm:font-bold">{score.live}</strong>{" "}
              indicates that you are at a {label} risk for likeness theft and misuse
              online.
            </p>
          </div>
        </section>

        {/* The one action the score implies, given its own card directly under it.
            Warm rather than lavender, which is the export's way of separating "here
            is what to do" from the two explanatory cards below. */}
        <DownloadPrompt
          handoff={handoff}
          className={`mt-7 sm:gap-10 lg:mt-[62px] ${WARM_CARD}`}
        >
          <p className="text-[16px] leading-6 font-semibold text-ink-warm sm:max-w-[510px] sm:text-2xl sm:leading-9">
            Download the ImageShield app for{" "}
            {/* Sized in em so it stays a step up at both breakpoints, and leading-none
                so the larger word doesn't push its line apart from the others. */}
            <em className="text-[1.15em] leading-none font-extrabold">personalized</em>{" "}
            recommendations on how you can improve your score and keep your likeness
            safe online.
          </p>
        </DownloadPrompt>

        <div className="mt-6 flex flex-col gap-9 sm:mt-9 sm:gap-10">
          <InsightCard
            heading="The primary risk factors that determined your initial score"
            rows={factorRows}
          />
          <InsightCard
            heading="General recommendations"
            rows={recommendations}
            variant="recommendations"
          />
        </div>

        <div className={`mt-10 lg:mt-[59px] ${WARM_CARD}`}>
          <DownloadPrompt handoff={handoff} className="sm:gap-10">
            <p className="text-[17px] leading-[22px] font-semibold text-ink-deep sm:max-w-[610px] sm:text-2xl sm:leading-9 sm:tracking-[-0.04em]">
              To see your{" "}
              {/* Set as the warm card above sets the same word. */}
              <em className="text-[1.15em] leading-none font-extrabold">personalized</em>{" "}
              recommendations and your complete Likeness Health Report
              <sup className="align-[5px] text-[0.4em] sm:align-[7px]">SM</sup>,
              including tips on how you can improve your online safety right away,
              download the ImageShield app
            </p>
          </DownloadPrompt>

          {/* Attached to every score response by the API, and meant to be shown: the
              score is likeness-protection health in MONITORED SOURCES. It is never
              "you're safe", never "across the web", and 100 is never an all-clear.
              `ink-soft` rather than the page's `ink-faint`: on the phone the card
              fades to orange at its foot, where #888 drops to ~2.3:1 and #666 to
              ~3.7:1 — both under AA for 14px text. #333 holds ~8:1. */}
          <p className="mt-8 text-sm leading-5 text-ink-soft sm:mt-10">
            {record.scopeNote}
          </p>
        </div>
      </div>

      <AppHandoffSection />
    </main>
  );
}
