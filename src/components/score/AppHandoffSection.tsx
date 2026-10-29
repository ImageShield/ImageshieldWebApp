"use client";

import { useId, useRef, useState } from "react";
import { ShimmerImage } from "@/components/ShimmerImage";

/**
 * "Benefits of the app" - the foot of the result screen.
 *
 * The score is already saved against the phone number the visitor just verified, so
 * there is no token to redeem and nothing to carry across: the handoff is "install
 * the app, sign in with that number". The store badges and the QR now sit further up
 * the page, in the two `DownloadPrompt` blocks - which is why this takes no `handoff`
 * any more: it is purely the pitch, with nothing in it addressed to one visitor.
 *
 * The feature list is a control, not a static list - the design's comment on the
 * mockup reads "This image can change based on the feature selected", so picking a
 * feature swaps the phone beside it. Built as a vertical tablist: four tabs, one
 * panel, which is what this is even though each tab keeps its own copy visible.
 *
 * The LHS Results V1 export draws these as four plain cards beside a fixed mockup,
 * with no selected state - but only ever produced the one app screen, so a static
 * version would be four cards pointing at the same picture. The tabs are kept and
 * restyled to the export's card, ready for the three screens that don't exist yet.
 *
 * Not `<DownloadSection>` from the landing page - that one is the black, centred
 * store-badge footer.
 *
 * The phone export stacks the three parts heading / mockup / cards rather than
 * putting the mockup in a column beside the cards, and that order is the reason the
 * markup below is three grid items rather than two columns: a phone reader meets
 * the screen the cards describe BEFORE the cards, so the first card has something to
 * change. Below `lg` the section is a column and `order` runs it; at `lg` the
 * explicit row/column placement takes over and restores the export's two columns.
 */

const FEATURES: ReadonlyArray<{
  title: string;
  body: string;
  /** The app screen this feature shows off. */
  screen: string;
  /** Describes that screen, since the image is the tab's whole payload. */
  screenAlt: string;
}> = [
  {
    title: "Weekly likeness detection reports",
    body: "We scan the entire web (and dark web) for instances of your likeness",
    screen: "/media/app-dashboard.png",
    screenAlt: "The ImageShield app showing a household's Likeness Health Scores",
  },
  {
    title: "24/7 Support",
    body: "We're available 24/7 to support you",
    /* TODO: the design only ever produced the dashboard mockup, so the three
       features below borrow it. Each is a one-line swap once its screen exists. */
    screen: "/media/app-dashboard.png",
    screenAlt: "The ImageShield app showing a household's Likeness Health Scores",
  },
  {
    title: "Personalized recommendations",
    body: "Recommendations tailored to your needs to keep your likeness safe",
    screen: "/media/app-dashboard.png",
    screenAlt: "The ImageShield app showing a household's Likeness Health Scores",
  },
  {
    title: "Stalker-proof privacy",
    body: "Our technology ensures that only you can track your face",
    screen: "/media/app-dashboard.png",
    screenAlt: "The ImageShield app showing a household's Likeness Health Scores",
  },
];

export function AppHandoffSection() {
  /* The design draws the first feature selected, and that is also the only one
     whose mockup exists - so it is the one the section opens on. */
  const [selected, setSelected] = useState(0);
  const ids = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabId = (i: number) => `${ids}-tab-${i}`;
  const panelId = `${ids}-panel`;
  const active = FEATURES[selected];

  /** Arrow keys move between tabs, as a tablist is expected to. */
  function onKeyDown(event: React.KeyboardEvent) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;

    let next = selected;
    if (step) next = (selected + step + FEATURES.length) % FEATURES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = FEATURES.length - 1;
    else return;

    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      id="download"
      className="mx-auto w-full max-w-[958px] px-5 pt-12 pb-24 sm:px-6 sm:pt-16 lg:pt-[52px] lg:pb-[120px]"
    >
      {/* The mockup's top edge sits level with the heading rather than with the
          cards, so at `lg` the heading takes the left column's first row and the
          mockup spans both. The rows are pinned `auto` then `1fr` because of that
          span: the mockup is half again as tall as the cards beside it, and a grid
          left to size its own rows hands that surplus to row one, pushing the
          heading a hundred pixels off the top of the mockup it is meant to align
          with. */}
      <div className="flex flex-col lg:grid lg:grid-cols-[438px_1fr] lg:grid-rows-[auto_1fr] lg:gap-x-[34px]">
        <h2 className="order-1 text-[17px] leading-6 font-bold text-ink-deep sm:text-2xl sm:leading-[1.07] sm:tracking-[-0.04em] lg:col-start-1 lg:row-start-1">
          Benefits of the app
        </h2>

        {/* Right-aligned rather than centred in its column at `lg`: the export runs
            the mockup's right edge to the content column's, and the caption centres
            under the phone rather than under the column. On a phone it is simply
            centred, between the heading and the cards. */}
        <div className="order-2 mt-7 flex justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:justify-end">
          <div className="flex flex-col items-center">
            <div id={panelId} role="tabpanel" aria-labelledby={tabId(selected)}>
              <ShimmerImage
                // Keyed so a swap replaces the element rather than mutating its
                // src, which would show the old screen until the new one decodes.
                // It resets the shimmer along with it, which is the behaviour
                // this tablist wants: picking a feature whose screen is not yet
                // cached shows the placeholder rather than the previous
                // feature's phone.
                key={active.screen}
                src={active.screen}
                alt={active.screenAlt}
                width={868}
                height={1812}
                // The mockup's own drawn widths, moved onto the frame so the
                // placeholder is a phone-shaped block rather than a band across
                // the column. Its height follows from the 868×1812 plate.
                frameClassName="w-[242px] rounded-[28px] sm:w-[280px] lg:w-[320px]"
                className="w-full"
              />
            </div>
            <p className="mt-4 text-[15px] font-bold text-ink sm:text-[13px]">
              Sample report
            </p>
          </div>
        </div>

        <div className="order-3 lg:col-start-1 lg:row-start-2">
          {/*
           * The export draws four plain cards with the first one a shade darker.
           * That shade is exactly what a selected tab needs, so the list is still a
           * tablist and the darker card is the selection - every row keeps the same
           * padding and only the ground changes, which is what stops the column
           * shifting as the selection moves.
           */}
          <ul
            role="tablist"
            aria-orientation="vertical"
            aria-label="App features"
            className="mt-8 flex flex-col gap-5 lg:gap-[25px]"
          >
            {FEATURES.map(({ title, body }, i) => {
              const on = i === selected;
              return (
                <li key={title}>
                  <button
                    type="button"
                    role="tab"
                    id={tabId(i)}
                    ref={(el) => {
                      tabs.current[i] = el;
                    }}
                    aria-selected={on}
                    aria-controls={panelId}
                    /* Roving tabindex: one stop for the whole list, then arrows. */
                    tabIndex={on ? 0 : -1}
                    onClick={() => setSelected(i)}
                    onKeyDown={onKeyDown}
                    className={`block w-full cursor-pointer rounded-2xl px-[22px] py-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta lg:py-[18px] ${
                      on ? "bg-[#EAEAF2]" : "bg-surface hover:bg-[#ECECF3]"
                    }`}
                  >
                    <span className="block text-[15px] leading-5 font-bold text-ink-deep sm:leading-none sm:tracking-[-0.018em]">
                      {title}
                    </span>
                    <span className="mt-1 block text-[15px] leading-[21px] text-ink-body-soft sm:text-[13px] sm:leading-[1.55]">
                      {body}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
