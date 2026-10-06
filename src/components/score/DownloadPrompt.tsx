import { ShimmerImage } from "@/components/ShimmerImage";
import type { Handoff } from "@/lib/handoff";
import { HandoffQr } from "./HandoffQr";

/**
 * A line of copy, a QR code and the two store badges.
 *
 * The page uses this twice, each in the same warm card — once under the score, once
 * between the recommendations and the app section — with different copy but the same
 * right-hand block, so that block lives here rather than being written out twice and
 * drifting.
 *
 * The QR comes from `/api/handoff/qr` and points at `/get-app`, which sends the
 * scanning phone to whichever of these two stores it uses. It has a component of
 * its own for the loading and failure states — see `HandoffQr`.
 */
export function DownloadPrompt({
  handoff,
  children,
  className = "",
}: {
  handoff: Handoff;
  /** The copy to the left of the codes. */
  children: React.ReactNode;
  className?: string;
}) {
  /**
   * Badges are matched on WIDTH — 167px of visible badge, one size in both prompts,
   * which is what the export draws.
   *
   * The two classes below are not the same number because the two PNGs are not
   * built the same. `badge-app-store.png` is full-bleed: its black body fills all
   * 1692×546, so a 167px box is a 167px badge. The Google Play badge carries
   * Google's own clear-space inside the file — its body is 632×182 within a 640×192
   * canvas — so an equal box would draw it 2px narrow. The Play box is therefore
   * scaled by 640/632, and the two visible badges come out the same width. Both
   * are written relative to their 169px column (167/169 = 98.8%) so they keep that
   * ratio when the column shrinks on a narrow phone — see the row below.
   *
   * Their heights then differ, 48 against 54, and that is the point: the two lockups
   * are different shapes (3.47:1 against 3.10:1), so one axis has to give. The
   * badges sit STACKED here, one above the other, and a stack is read down its
   * edges — unequal widths leave a ragged right margin that reads as a mistake from
   * across the room, where unequal heights just read as two different logos. That is
   * why this matches widths even though Apple's and Google's own marketing
   * guidelines each ask for equal heights: those guidelines assume the badges sit
   * side by side on one baseline, which is not this layout.
   */
  const appStore = "w-[98.8%]";
  const play = "w-full";

  /* Side by side from `md`, not `sm`: inside the warm card at 640–767px the codes'
     305px leave the copy a ~200px column, and the badges ran into the card's edge. */
  return (
    <div
      className={`flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between ${className}`}
    >
      {children}

      {/* On a phone the row is the export's 318px — a 121px code, a 28px gap, the
          169px badges — written as shares of that width, so below the ~400px screen
          it was drawn for, where the card's inside is narrower than 318, the whole
          row scales down as one instead of running out of the card and making the
          page scroll sideways. From `sm` it takes its fixed desktop sizes. */}
      <div className="flex w-full max-w-[318px] shrink-0 items-center gap-[8.8%] sm:w-auto sm:max-w-none sm:gap-4">
        {/* Sized as the drawn side of the white card — the code inside it is that
            less the padding either side. */}
        <HandoffQr className="aspect-square w-[38%] sm:size-[120px]" padding="p-3 sm:p-2.5" />

        <div className="flex w-[53.2%] flex-col gap-3 sm:w-[169px]">
          <a
            href={handoff.playStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            {/* The badge's own box is the frame, so the placeholder holds the
                widths worked out above rather than collapsing the row while
                two PNGs come down a slow line. */}
            <ShimmerImage
              src="/media/badge-google-play.png"
              alt="Get it on Google Play"
              width={640}
              height={192}
              frameClassName={`rounded-[7px] ${play}`}
              className="h-auto w-full"
            />
          </a>
          <a
            href={handoff.appStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <ShimmerImage
              src="/media/badge-app-store.png"
              alt="Download on the App Store"
              width={1692}
              height={546}
              frameClassName={`rounded-[7px] ${appStore}`}
              className="h-auto w-full"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
