import Image from "next/image";
import { ShimmerImage } from "@/components/ShimmerImage";
import { appQrSvg } from "@/lib/app-qr";
import { STORE_LINKS } from "@/lib/site-nav";
import { HeroNav } from "./HeroNav";
import { Star } from "./icons";

/**
 * Concept 1's hero: the pitch on a black canvas, the photograph bled in from the
 * right, and the download card floating over its bottom corner.
 *
 * The photograph is the one the old `ProtectsSection` ran under its headline, but
 * not the same FILE: that was `protects.jpg`, 65KB for 1792×1057 — a thirtieth of
 * a bit per pixel — which survived being a backdrop behind a headline and does not
 * survive being the subject. This is the export's own lossless copy at its native
 * 1734×1024, which is all the resolution the design has: drawn at 1594px the hero
 * is fine at 1×, and still short of half the pixels it wants at 2×. Only a larger
 * original fixes that part.
 *
 * Placement, off the 1440×848 frame: the image is drawn 1594×941 with its left
 * edge at x 178 and its BOTTOM on the hero's bottom, so 93px of it is cut off the
 * top and 332px off the right. Those are carried here as percentages of the hero
 * box — 110.69% wide, 110.97% tall, `right: -23.06%` — which at 1440×848 is the
 * frame exactly, and past 1440 the `max()` freezes that offset at the design's
 * 332px: the extra width belongs to the black canvas the copy sits on, not to the
 * picture, which left to scale would grow to fill a 1920 monitor while the type
 * around it stayed 60px.
 *
 * All of that is `xl` and up, not `lg`, and for one reason: it is stated against
 * the hero's HEIGHT, and the height is only the design's 848 while the download
 * card floats. The card cannot float until 1280 (see below), so under `xl` the
 * hero is as tall as its own copy — and a 110.97% of THAT blows the picture up
 * until the subject is off the right-hand edge entirely.
 *
 * So under `xl` the frame is ours: the same photograph fills the section under a
 * flat wash, centred. Centred is the whole of it — she stands at 50.0% of the
 * plate's width, by the shield's glow and by the lit half of her sweater alike, so
 * any object-position but the middle walks her off to one side. The design draws no
 * narrower frame, and this one would not survive the narrowing anyway — at 390 the
 * picture's left edge lands at x 48 and the headline would be set across her face.
 */
export async function HeroSection() {
  /* Drawn at build — the page is static — from the same source as the result
     screen's code. No margin: the plate below is the quiet zone. */
  const qr = await appQrSvg({ margin: 0 });

  return (
    <section className="relative isolate overflow-hidden bg-night xl:min-h-[848px]">
      <div className="absolute inset-0 xl:top-auto xl:right-[max(-332px,-23.06%)] xl:bottom-0 xl:left-auto xl:h-[110.97%] xl:w-[min(110.69%,1594px)]">
        {/* The heaviest asset on the site by a factor of four, and the first
            thing above the fold — so it is the one placeholder that matters
            most. `night`, because it fills a box on a black canvas: the light
            skeleton would be a viewport-wide white panel where the photograph
            goes, which is worse than the black it replaces. */}
        <ShimmerImage
          night
          src="/media/hero-protects.png"
          alt="A woman looking at her phone, her face ringed by a glowing shield, with anonymous hooded figures fading into the dark behind her."
          fill
          priority
          /* The box is 110.69% of the viewport, capped at the design's 1594px — tell
             the browser that, or it picks a candidate a tenth too small and the
             upscale lands on the one face on the page. */
          sizes="(min-width: 1440px) 1594px, 111vw"
          /* Above the default 75. This is a near-black photograph whose whole
             subject is one lit face: at 75 the optimizer spends its bits on the
             gradient and smooths her eyelashes and hair into the dark. */
          quality={90}
          className="object-cover object-center xl:object-left"
        />

        {/* The photograph's left edge is a seam: black canvas on one side, the
            picture's own near-black on the other. At 1440 it falls at x 178, behind
            the copy, where the design hides it; past that it walks out into the
            open. The fade lives inside the picture's box, so it sits on the seam at
            every width, and covers ground that is already black. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 hidden w-[200px] bg-linear-to-r from-night to-transparent xl:block"
        />
      </div>

      {/* The design needs no wash — the copy sits on the picture's own black
          left-hand side. Every narrower frame sets it across the picture proper, so
          those do. */}
      <div className="absolute inset-0 bg-night/65 xl:hidden" />

      <HeroNav />

      {/* The 88px inset is measured from the viewport, not from a centred 1440
          container, so the headline keeps sitting 48px right of the logo at any
          width — `HeroNav` holds its own 40px the same way. */}
      <div className="relative z-10 px-6 pt-14 pb-12 sm:px-10 xl:px-[88px] xl:pt-[305px] xl:pb-[92px]">
        <h1 className="max-w-[700px] text-[2rem] leading-[2.375rem] font-semibold text-white sm:text-[2.75rem] sm:leading-[3.25rem] xl:text-[60px] xl:leading-[66px]">
          ImageShield® Protects You From AI, Deepfakes and Scams
        </h1>

        <p className="mt-6 max-w-[660px] text-base leading-6 text-white xl:mt-[33px]">
          ImageShield protects you and your family by monitoring for deepfakes,
          scams, impersonations, and photo-based identity theft, helping you
          stay safe and in control of your digital image.
        </p>

        <div className="mt-7 flex items-center gap-6 xl:mt-[31px]">
          <div
            className="flex gap-px pr-2 text-star"
            role="img"
            aria-label="Rated 5 out of 5"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="size-5" />
            ))}
          </div>
          <span aria-hidden className="h-4 w-px bg-white/30" />
          <p className="text-sm leading-5 font-semibold text-ink-onnight">
            Thousands of Families Protected
          </p>
        </div>

        {/*
         * 296×175 at 84px in from the right and 92px up from the hero's bottom.
         * Anchored to the bottom rather than to the design's y 581 so it keeps that
         * relationship if the copy above it ever pushes the hero past 848px.
         *
         * It only floats from `xl`. The paragraph beside it runs to x 748 and the
         * card's left edge is 380px in from the right, so the two clear each other
         * only past 1128 — at 1024 the card would be set across the last two lines
         * of the sentence it is meant to follow. Under that it is in flow, which is
         * also the answer on a phone: there is no bottom corner to float over, and
         * store badges below the fold would be the only way to install the thing
         * this page is selling.
         */}
        <div className="mt-10 w-[296px] max-w-full rounded-2xl bg-card-night py-6 pr-[30px] pl-6 xl:absolute xl:right-[84px] xl:bottom-[92px] xl:mt-0">
          <p className="text-base leading-6 font-semibold text-white">
            Free to download!
          </p>

          <div className="mt-[7px] flex items-center gap-[18px]">
            {/* 12px of quiet zone inside the plate, which is what makes the code
                scannable off a dark page at all — a QR needs light around it. 97px,
                not 96: the design strokes a 96px square, and a stroke Figma centres
                on the path is a border CSS puts inside the box. One pixel, but the
                card is pinned by its BOTTOM edge, so losing it lifts everything
                above the plate — the label included — a pixel off the design. */}
            <div className="flex size-[97px] shrink-0 items-center justify-center rounded-2xl border border-line bg-white">
              <Image
                src={`data:image/svg+xml,${encodeURIComponent(qr)}`}
                alt="QR code to get the ImageShield app"
                width={73}
                height={73}
                className="size-[73px]"
              />
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={STORE_LINKS.appStore}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[7px] border border-ink-onnight/65 transition-opacity hover:opacity-80"
              >
                <ShimmerImage
                  night
                  src="/media/badge-app-store.png"
                  alt="Download on the App Store"
                  width={1692}
                  height={546}
                  frameClassName="h-[42px] w-[127px]"
                  className="size-full object-cover"
                />
              </a>
              <a
                href={STORE_LINKS.googlePlay}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[7px] border border-ink-onnight/65 transition-opacity hover:opacity-80"
              >
                <ShimmerImage
                  night
                  src="/media/badge-google-play.png"
                  alt="Get it on Google Play"
                  width={640}
                  height={192}
                  frameClassName="h-[38px] w-[127px]"
                  className="size-full object-cover"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
