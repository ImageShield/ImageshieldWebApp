import { RISK_LEGEND } from "@/lib/score";

/**
 * The key printed under the gauge: three bands, each with its colour and its range.
 *
 * New in the LHS Results V1 export, and it replaces the "High Risk" / "Low Risk"
 * captions that used to sit inside the drawing under the 0 and 100 ticks. Moving it
 * out is what lets it name all three bands rather than only the two ends - and it
 * puts the ranges on the page, which is the thing that makes a bare 43 legible.
 *
 * Deliberately not a legend for the SCORE: nothing here is highlighted for the band
 * the visitor landed in. It is a scale, the same for everyone, which is why the arc
 * above it and the headline beside it are left to say where this person sits.
 *
 * A plain grid rather than a list, because the three rules have to sit on one line
 * across the gauge's width whatever the labels underneath do.
 *
 * The type is one treatment at every width - the gauge above it is specified in px
 * rather than in ems, so it is drawn at one size too, and a scale that changed under
 * a fixed arc would only look like a mistake. The phone keeps its own MEASURE: the
 * export draws the three columns 100px each on a 403px frame, narrower than the
 * 333px the desktop gives them.
 */
export function ScoreScale() {
  return (
    <div className="mx-auto grid max-w-[310px] grid-cols-3 gap-x-[5px] sm:max-w-none sm:gap-x-1.5">
      {RISK_LEGEND.map((band) => (
        <div key={band.level}>
          {/* The rule is the swatch. Painted from a CSS variable rather than a
              Tailwind class, since an interpolated `bg-risk-${level}` is never
              generated - the scanner only sees whole class names. */}
          <div
            aria-hidden
            className="h-[3px] w-full rounded-full sm:h-1"
            style={{ backgroundColor: band.colour }}
          />
          <p className="mt-1 text-center text-[12px] leading-5 font-medium text-ink-muted sm:mt-2">
            {band.label}
          </p>
          {/* 4px, which puts 24px between the two cap heights - the export's own
              figure, and the same on both sides of the breakpoint. */}
          <p className="mt-1 text-center text-[12px] leading-5 font-bold text-ink-report">
            {band.range}
          </p>
        </div>
      ))}
    </div>
  );
}
