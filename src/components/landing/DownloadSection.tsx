import { SOCIAL_LINKS } from "@/lib/site-nav";
import {
  Facebook,
  Instagram,
  LinkedIn,
  Shield,
  Twitter,
  YouTube,
} from "./icons";

const SOCIAL_ICONS = {
  Facebook,
  X: Twitter,
  Instagram,
  LinkedIn,
  YouTube,
} as const;

const TRUST_MARKERS = [
  "Patented Technology",
  "Complete Privacy",
  "24/7 Monitoring for Potential Dangers",
];

/**
 * Social links and trust markers - the foot of the page.
 *
 * Concept 1 draws nothing below How It Works, and it has already said everything
 * this section used to: the five stars, the line about families protected and both
 * store badges are in the hero card now. What is left is the part of the old strip
 * the new design has no place for and the page would be poorer without, kept on
 * the black it has always been on.
 *
 * `#download` still resolves here, which is where the nav's Download app button
 * points on a phone - the hero's own badges are above the fold on desktop, but a
 * visitor who has scrolled to the bottom should not have to scroll back.
 */
export function DownloadSection() {
  return (
    <section
      id="download"
      className="flex flex-col items-center bg-night px-6 pt-16 pb-24 lg:pt-[69px] lg:pb-[120px]"
    >
      <p className="text-sm text-ink-onnight-dim">
        Free to download • Start your protection today
      </p>

      <ul className="mt-6 flex items-center gap-6 lg:mt-[21px]">
        {SOCIAL_LINKS.map((social) => {
          const Icon = SOCIAL_ICONS[social.label];
          return (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer"
                aria-label={social.label}
                // 24px on the grid, but `after` stretches the hit area to 44px so
                // the icons stay 24px apart the way the design has them.
                className="relative block size-6 text-white/80 transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:text-white"
              >
                <Icon className="size-6" />
              </a>
            </li>
          );
        })}
      </ul>

      <ul className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-8 lg:mt-[18px]">
        {TRUST_MARKERS.map((marker) => (
          <li
            key={marker}
            className="flex items-center gap-[9px] text-sm text-ink-onnight-faint"
          >
            <Shield className="size-4 shrink-0 text-accent-bright" />
            {marker}
          </li>
        ))}
      </ul>
    </section>
  );
}
