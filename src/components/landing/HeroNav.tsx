"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { STEP_PATHS } from "@/lib/funnel";
import { HERO_NAV, HOME_URL } from "@/lib/site-nav";
import { Close, Menu } from "./icons";

/**
 * Concept 1's bar, over the landing hero only.
 *
 * Measured off the 1440-wide design: a full-bleed 96px row with a 1px `ink-soft`
 * rule under it, the logo 40px in from the left at its native 178×40, the five
 * links set 16px in `ink-onnight` with 35px between them, then the two pills the
 * bar ends with - a 212×50 outline and a 154×48 solid white - 24px apart, the
 * second ending 53px from the right edge.
 *
 * The bar has no fill of its own. It is a 10px backdrop blur and nothing else, so
 * what shows through it is the top of the photograph behind - which at that height
 * is near enough black that the rule, not a panel edge, is what separates the two.
 * That only works over a photograph: every funnel screen is a near-white canvas,
 * where white on clear glass is unreadable, so those keep the solid V1 bar.
 *
 * The insets are held against the viewport rather than a centred 1440 container.
 * Capping them there would turn the bar into a centred strip with gutters on a
 * wider monitor and pull the logo away from the headline underneath it, which
 * `HeroSection` also holds against the viewport for the same reason.
 *
 * Logo, five 16px links and the two pills need 1149px of the 1440 the design gives
 * them, so the run collapses behind a disclosure under `xl` rather than `lg`: at
 * 1024 the links overlap the wordmark and "How It Works" breaks onto two lines. The
 * bar takes its full 96px height at the same breakpoint, so the 305px the hero
 * below it holds to the headline is measured from the same place the design does. The pills go into the
 * disclosure with them rather than staying in the row: they are the two most
 * important destinations on the page, and shrinking them to fit beside a hamburger
 * is what would make them look optional.
 */
export function HeroNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 border-b border-ink-soft backdrop-blur-[10px]">
      <div className="flex h-16 items-center justify-between pr-4 pl-6 sm:pl-10 xl:h-24 xl:pr-[53px]">
        <Link href={HOME_URL} aria-label="ImageShield home" className="shrink-0">
          <Image
            src="/media/logo-wordmark.svg"
            alt="ImageShield"
            width={178}
            height={40}
            priority
            className="h-8 w-auto xl:h-10"
          />
        </Link>

        {/* Links and pills are one group, not two children of the row's
            `justify-between`: the design hangs the whole run off the right edge -
            the last pill 53px in, the links ending 34px before the first one - and
            an even distribution would instead park the links halfway between the
            logo and the pills, 40px left of where the design puts them. */}
        <div className="hidden items-center gap-[34px] xl:flex">
          <nav aria-label="Main">
            <ul className="flex items-center gap-8">
              {HERO_NAV.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-base text-ink-onnight transition-opacity hover:opacity-70"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-6">
            <Link
              href={STEP_PATHS.quiz}
              className="flex h-[50px] w-[212px] items-center justify-center rounded-full border border-white text-base text-white transition-colors hover:bg-white/10"
            >
              Likeness Health Score
            </Link>
            <a
              href="#download"
              className="flex h-12 w-[154px] items-center justify-center rounded-full bg-white text-base text-ink transition-opacity hover:opacity-90"
            >
              Download app
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="hero-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex size-tap items-center justify-center text-ink-onnight xl:hidden"
        >
          {open ? <Close className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open ? (
        <nav
          id="hero-nav"
          aria-label="Main"
          /* The bar itself is clear glass over a photograph. A panel of links has to
             be a surface, so the disclosure takes the ground the hero sits on. */
          className="bg-night/95 pb-6 backdrop-blur-[10px] xl:hidden"
        >
          <ul className="flex flex-col px-6">
            {HERO_NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-tap items-center text-base text-ink-onnight"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-3 px-6">
            <Link
              href={STEP_PATHS.quiz}
              onClick={() => setOpen(false)}
              className="flex h-[50px] items-center justify-center rounded-full border border-white text-base text-white"
            >
              Likeness Health Score
            </Link>
            <a
              href="#download"
              onClick={() => setOpen(false)}
              className="flex h-12 items-center justify-center rounded-full bg-white text-base text-ink"
            >
              Download app
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
