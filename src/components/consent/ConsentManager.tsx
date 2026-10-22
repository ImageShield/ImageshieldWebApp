"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Consent,
  PENDING,
  clearTrackingCookies,
  hasStaleConsent,
  reloadPage,
  updateGoogleConsent,
  useConsent,
  writeConsent,
} from "@/lib/consent";
import { ConsentBanner } from "./ConsentBanner";
import { TrackingScripts } from "./TrackingScripts";

/**
 * Asks before anything optional runs, loads what was agreed to, and keeps a
 * "Cookie settings" link at the foot of every page to change it.
 *
 * Rendered once, from the root layout, so the choice and the scripts it allowed
 * carry across every client-side navigation through the quiz.
 *
 * It wraps the page so the banner can come first in the document — the first thing
 * a keyboard or screen-reader visitor meets, though it is drawn at the bottom — and
 * the "Cookie settings" link last, where a footer link belongs. Every slot below
 * holds its place whether or not it renders, and `children` is the same element on
 * every render, so the screen itself is never remounted or re-rendered by a change
 * of consent: a half-filled form keeps what was typed.
 *
 * Granting something takes effect at once. Withdrawing it can't — a running script
 * can't be unloaded — so it tells Google first (so nothing more is stored), deletes
 * the cookies, and reloads into a page that never loads them.
 */
export function ConsentManager({ children }: { children: ReactNode }) {
  const consent = useConsent();
  const [managing, setManaging] = useState(false);
  const decided = consent === PENDING ? null : consent;
  const showBanner = consent !== PENDING && (consent === null || managing);

  const trigger = useRef<HTMLButtonElement>(null);
  /* Set by whatever closes the banner, and acted on once it has actually gone —
     the button that closed it is removed in that render, taking focus with it. */
  const returnFocus = useRef<FocusOptions | null>(null);

  useEffect(() => {
    if (showBanner || !returnFocus.current) return;
    trigger.current?.focus(returnFocus.current);
    returnFocus.current = null;
  }, [showBanner]);

  /**
   * Focus goes back to "Cookie settings", the control that reopens the choice. On a
   * long page that link is below the fold, so for a mouse or a tap it moves without
   * scrolling: those visitors aren't steered by focus, and shouldn't be carried to
   * the foot of the page for answering a banner at the top.
   */
  function close(byPointer: boolean) {
    returnFocus.current = { preventScroll: byPointer };
    setManaging(false);
  }

  function save(next: Consent, byPointer: boolean) {
    /* A choice from an older consent version reads as no choice at all, so the banner
       asks again — but whatever its "yes" stored is still on the device. A "no" now
       clears that too. Nothing of it is loaded on this page, so no reload. */
    const stale = decided === null && hasStaleConsent();
    const withdrawn = {
      analytics: (Boolean(decided?.analytics) || stale) && !next.analytics,
      marketing: (Boolean(decided?.marketing) || stale) && !next.marketing,
    };
    writeConsent(next);
    updateGoogleConsent(next);
    close(byPointer);
    if (withdrawn.analytics || withdrawn.marketing) {
      clearTrackingCookies(withdrawn);
      if (!stale) reloadPage();
    }
  }

  return (
    <>
      {decided ? <TrackingScripts consent={decided} /> : null}

      {/* Nothing until hydration has read the cookie: guessing "undecided" on the
          server would flash the banner at everyone who already answered. */}
      {showBanner ? (
        <ConsentBanner
          key={managing ? "manage" : "summary"}
          initial={decided ?? { analytics: false, marketing: false }}
          manage={managing}
          onSave={save}
          onCancel={decided ? close : undefined}
        />
      ) : null}

      {children}

      {/* Laid over the foot of the screen rather than after it: every screen is a
          full-viewport <main> with its own background, so a strip in the flow made
          each one scroll and showed a white band under its tint. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[env(safe-area-inset-bottom)]">
        <button
          ref={trigger}
          type="button"
          onClick={() => setManaging(true)}
          className="pointer-events-auto min-h-tap px-3 text-xs text-ink-muted underline underline-offset-2 hover:text-ink-soft"
        >
          Cookie settings
        </button>
      </div>
    </>
  );
}
