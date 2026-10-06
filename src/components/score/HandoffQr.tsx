"use client";

import { useCallback, useState } from "react";

/**
 * The QR code on the result screen, with a shimmering plate until it arrives.
 *
 * `/api/handoff/qr` is drawn once at build time and is the same for everyone —
 * it points at `/get-app` — so it usually lands with the badges beside it. The
 * plate and the failure line below are for the slow network and the failed
 * request, where an empty square would read as broken.
 *
 * A plain `<img>` rather than `next/image` (and so not `ShimmerImage`): the
 * optimizer refuses SVG unless `dangerouslyAllowSVG` is switched on site-wide,
 * and a vector code gains nothing from resizing anyway. That means the
 * cached-image guarantee `next/image` provides has to be written by hand — see
 * `settle` below.
 *
 * The placeholder sits UNDER the code rather than over it, for the reason
 * `ShimmerImage` sets out at length: an `<img>` paints nothing until it has
 * pixels, so the shimmer shows through by itself and the code covers it when
 * it lands, with no dependency on React having hydrated. The only state that
 * does need JavaScript is the failure below, and that is the one case where
 * falling back to the browser's own broken-image box is the right answer
 * anyway.
 */
export function HandoffQr({
  className = "",
  padding,
}: {
  /** The plate: its size and shrink behaviour, which the caller measures. */
  className?: string;
  /** The quiet zone inside the plate, without which a code will not scan. */
  padding: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  /**
   * Resolves a picture the browser already had.
   *
   * An `<img>` that is complete before React attaches its handlers fires
   * neither `load` nor `error` — the events are long gone — and the placeholder
   * would then sit over a perfectly good code until the page was left. This ref
   * runs on mount and settles that case from `complete`, with `naturalWidth`
   * telling a decoded picture from a failed request, which reports complete
   * too.
   *
   * A stable `useCallback` rather than an inline arrow: an inline ref is a new
   * function every render, so React detaches and reattaches it on each one and
   * this would run again after every state change it caused.
   */
  const settle = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setState(img.naturalWidth > 0 ? "ready" : "failed");
  }, []);

  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-2xl bg-canvas align-top ${className}`}
    >
      {state === "loading" ? (
        <span aria-hidden className="skeleton absolute inset-0" />
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above. */}
      <img
        src="/api/handoff/qr"
        alt="QR code to get the ImageShield app"
        width={120}
        height={120}
        ref={settle}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        /* `relative` puts it over the placeholder — see the note above. It is
           hidden only on failure, where what it would otherwise draw is a
           broken-image glyph on top of the line explaining the breakage. */
        className={`relative size-full ${padding} ${
          state === "failed" ? "opacity-0" : ""
        }`}
      />

      {/* A code that will not load is not worth a retry button: the two store
          badges next to it go to the same two places, so the visitor has
          already been handed the way through. Saying so quietly is enough, and
          it keeps the plate from reading as a rendering bug. The `<img>` above
          stays mounted rather than being removed, so the plate does not resize
          under the line. */}
      {state === "failed" ? (
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] leading-[14px] font-medium text-ink-faint">
          Code unavailable — use the badges
        </span>
      ) : null}
    </span>
  );
}
