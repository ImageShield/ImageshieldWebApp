import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ShieldMark } from "@/components/ShieldMark";
import { nextPath, STEP_PATHS } from "@/lib/funnel";

export const metadata: Metadata = {
  title: "ImageShield - Likeness Health Quiz",
  description:
    "Our free online assessment will determine your risk of likeness theft online. It only takes a minute and we’ll have recommendations for you to protect yourself.",
};

/**
 * Quiz intro - where "Take the Quiz" lands.
 *
 * Still the marketing site rather than the funnel proper: it keeps the site header
 * and the full-width canvas, and only the column underneath is funnel-shaped. So
 * this screen builds its own shell instead of reaching for `<Screen>`, which is
 * phone-first and caps at 30rem.
 *
 * Measured off the 1920×1280 design: a 536px column centred on the page, sitting
 * 199px below the 65px header, everything inside it flush left. That puts the badge
 * at y=264 and the heading's cap line at 398, both the export's own numbers.
 *
 * The button no longer lands on the export's y=612. The copy since changed - the
 * heading lost "proprietary" and so a line, the paragraph gained one - and 36px off
 * the first against 24px onto the second leaves it 12px higher, at 600. It is left
 * to flow there rather than padded back onto a number the export measured for
 * sentences that are no longer on the page.
 */
export default function QuizIntroPage() {
  // `quiz` is never the last step, so the fallback here is unreachable - it exists
  // only so the target stays derived from the funnel order rather than hardcoded.
  const next = nextPath("quiz") ?? STEP_PATHS.landing;

  return (
    <main className="relative min-h-[100dvh] bg-canvas-tint">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[576px] px-5 pt-[65px]">
        <div className="pt-16 pb-24 sm:pt-24 lg:pt-[199px]">
          {/* The badge carries its own glow: a slightly larger disc of the same
              purple, blurred out to a haze the design only barely shows. */}
          <div className="relative w-24">
            <div
              aria-hidden
              className="absolute -inset-1.5 rounded-full bg-brand-bright opacity-[0.072] blur-[40px]"
            />
            <div className="relative flex size-24 items-center justify-center rounded-full bg-brand-bright/10">
              <ShieldMark className="w-[37px] text-ink-soft" />
            </div>
          </div>

          {/* No `text-balance`: the design runs this to the full 536px measure, and
              balancing pulls the last line up into a narrower, off-design block. */}
          <h1 className="mt-7 text-2xl leading-9 font-bold text-ink-soft">
            Our Likeness Health Quiz will determine your risk of likeness theft
            and abuse.
          </h1>

          {/* 16/24, not 16/20: the export steps these two lines 24px apart, and the
              4px it adds back is what lands the button on the design's y=612.

              80% black rather than the heading's flat #333333 - the export sets
              these two blocks differently, and over the tint the two land a step
              apart. */}
          <p className="mt-[18px] text-base leading-6 text-black/80">
            Our free online assessment will determine your risk of likeness theft
            online. It only takes a minute and we&rsquo;ll have recommendations for
            you to protect yourself.
          </p>

          {/* Nothing to record yet, so this is a plain navigation rather than the
              funnel's <Button> - and a pill, which <Button> is not. */}
          <Link
            href={next}
            className="mt-[50px] flex h-14 w-full items-center justify-center rounded-[36px] bg-brand text-base leading-6 font-semibold text-ink-inverse transition-colors hover:bg-cta"
          >
            Let&rsquo;s begin
          </Link>
        </div>
      </div>
    </main>
  );
}
