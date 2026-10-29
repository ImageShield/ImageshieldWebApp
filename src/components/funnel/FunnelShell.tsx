import type { ReactNode } from "react";
import { SiteHeader } from "@/components/landing/SiteHeader";

/**
 * The shell the details and OTP screens share.
 *
 * Still the marketing site rather than the funnel proper - same reasoning as the
 * quiz intro, so this doesn't reach for `<Screen>` either: the site header stays,
 * the canvas stays full width, and only the column underneath is funnel-shaped.
 *
 * Measured off the 1920×1271 details export: a 560px column centred on the page,
 * its heading 179px below the 65px header, everything inside it flush left. The
 * design draws desktop only; the top gap collapses on smaller screens, where
 * 179px of nothing would push the first field off a phone.
 */
export function FunnelShell({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-[100dvh] bg-canvas-tint">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[600px] px-5 pt-[65px]">
        <div className="pt-12 pb-24 sm:pt-24 lg:pt-[179px]">
          {/* Same 24/36 Bold black as the quiz question - these screens ask
              a question too, so they carry the question style rather than their
              own. Flat across breakpoints: the quiz doesn't step down on a phone
              either, and a heading that changes size between funnel steps reads
              as two different screens. */}
          <h1 className="text-[24px] leading-9 font-bold text-black">
            {title}
          </h1>

          {/* Same 14/21 black-at-45% as the quiz's "Select all that apply" - it
              plays the same part here, qualifying the question above it. */}
          <p className="mt-5 text-[14px] leading-[21px] text-black/45">
            {subtitle}
          </p>

          {children}
        </div>
      </div>
    </main>
  );
}
