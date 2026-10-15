"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { HOME_URL, SITE_NAV } from "@/lib/site-nav";
import { Close, Menu } from "./icons";

/**
 * Solid purple bar that sits over the top of the hero video.
 *
 * Measured off the 1920-wide design: a 65px full-bleed bar, logo 276px in from the
 * left, the link row ending 64px from the right, 32px between links. Both paddings
 * are set in vw so that ratio holds down the range and caps at the design values on
 * anything wider. Seven links stop fitting below ~1280, so they collapse behind a
 * disclosure under `xl` (the design only specifies desktop).
 */
/**
 * A link's text, with the service mark where the design shows one. Its size and
 * rise are measured off the design in px — the row is a fixed 16px either way.
 */
function NavLabel({ item }: { item: (typeof SITE_NAV)[number] }) {
  return (
    <>
      {item.label}
      {item.mark ? (
        <sup className="align-[4.6px] text-[0.35em]">{item.mark}</sup>
      ) : null}
    </>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="flex h-[65px] items-center justify-between bg-navbar px-6 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_10px_15px_rgba(0,0,0,0.1)] backdrop-blur-[2px] xl:pr-[clamp(1.5rem,3.34vw,64px)] xl:pl-[clamp(1.5rem,14.375vw,276px)]">
        <Link href={HOME_URL} aria-label="ImageShield home" className="shrink-0">
          <Image
            src="/media/logo.png"
            alt="ImageShield"
            width={193}
            height={56}
            loading="eager"
            fetchPriority="high"
            className="h-8 w-auto xl:h-10"
          />
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-8">
            {SITE_NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`text-base font-bold transition-opacity hover:opacity-70 ${
                    item.bright ? "text-white/90" : "text-ink-onnav"
                  }`}
                >
                  <NavLabel item={item} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="-mr-2 flex size-tap items-center justify-center text-ink-onnight xl:hidden"
        >
          {open ? <Close className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="bg-navbar pb-2 shadow-[0_10px_15px_rgba(0,0,0,0.1)] xl:hidden"
        >
          <ul className="flex flex-col px-6">
            {SITE_NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-tap items-center text-base font-bold ${
                    item.bright ? "text-white/90" : "text-ink-onnav"
                  }`}
                >
                  <NavLabel item={item} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
