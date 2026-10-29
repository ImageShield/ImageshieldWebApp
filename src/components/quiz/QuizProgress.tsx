import Link from "next/link";
import { ChevronLeft, Close } from "@/components/landing/icons";

/**
 * The bar across the top of every question: back, how far along you are, and a way out.
 *
 * Measured off the design as an 800px track with the back chevron 15px to its left
 * and the close cross 9px to its right, the row centred on the page. Both controls
 * get a full 44px tap target, which is wider than the glyph the design draws, so
 * they're pulled outward by the difference - that keeps the *ink* on the design's
 * marks instead of the invisible button box.
 */
export function QuizProgress({
  step,
  total,
  onBack,
}: {
  /** 1-based, so `step / total` is a full bar on the last question. */
  step: number;
  total: number;
  onBack: () => void;
}) {
  return (
    /* 920 = the design's 880px ink-to-ink row plus the 20px gutters. */
    <div className="mx-auto flex w-full max-w-[920px] items-center px-5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Previous question"
        className="-ml-[17px] flex size-11 shrink-0 items-center justify-center text-ink-soft transition-opacity hover:opacity-60"
      >
        <ChevronLeft className="size-[30px]" />
      </button>

      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Question ${step} of ${total}`}
        className="mr-2 ml-[15px] h-2 flex-1 overflow-hidden rounded-full bg-track"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      <Link
        href="/"
        aria-label="Leave the quiz"
        className="-mr-[14px] flex size-11 shrink-0 items-center justify-center text-ink-soft transition-opacity hover:opacity-60"
      >
        <Close className="size-7" />
      </Link>
    </div>
  );
}
