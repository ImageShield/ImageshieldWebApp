"use client";

import { reloadPage, updateGoogleConsent } from "./consent";
import { NOT_ELIGIBLE_PATH } from "./funnel";
import { readFunnel } from "./funnel-state";
import { declaresMinor } from "./quiz";

/**
 * Sends someone who answered "Under 18" to /not-eligible, with a full page load.
 *
 * Not `router.push`: a client-side navigation keeps the current document, and with it
 * any tags GTM has already started - Google's own engagement and scroll events would
 * then report the /not-eligible address and its "You need to be 18 or older" title,
 * which says the visitor is a minor. A fresh document is one TrackingScripts can
 * refuse to load anything into (see `trackingBlocked`), whatever the container holds.
 *
 * Before leaving, the tags still running here are told consent is denied, so nothing
 * they might send on the way out (or if the browser restores this page from its
 * back/forward cache) carries a cookie or client ID. The visitor's stored choice is
 * untouched. `replace` keeps the router's history behaviour: the screens that
 * replaced before still do.
 */
export function leaveForNotEligible(
  mode: "push" | "replace",
  location: Pick<Location, "assign" | "replace"> = window.location,
): void {
  markUnder18();
  if (mode === "replace") location.replace(NOT_ELIGIBLE_PATH);
  else location.assign(NOT_ELIGIBLE_PATH);
}

/** Set in this tab once the visitor says they are under 18. Never cleared by the quiz. */
const UNDER_18_KEY = "imageshield.under18";

/**
 * Called the moment an under-18 answer is given, not only when the visitor is sent
 * away: the quiz still asks the remaining questions first, and the tags already running
 * would otherwise keep reporting page changes and engagement for them until then. Tells
 * those tags consent is denied (the visitor's stored choice is untouched) and records
 * the fact for this tab, so it outlives the answers - a new quiz version clears those.
 */
export function markUnder18(): void {
  /* Once per tab: every later page in it loads no tags, so there's nothing new to tell. */
  if (flaggedUnder18()) return;
  try {
    window.sessionStorage.setItem(UNDER_18_KEY, "1");
  } catch {
    // Private mode or quota: the stored answers still say it, for as long as they last.
  }
  updateGoogleConsent({ analytics: false, marketing: false });
}

function flaggedUnder18(): boolean {
  try {
    return window.sessionStorage.getItem(UNDER_18_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether this tab belongs to someone who said they are under 18 - by their current
 * answers, or at any point before. Correcting the age afterwards lets them on through
 * the quiz, as before, but this tab stays untracked: a misclick costs one visit's
 * analytics, a real minor never gets tracked.
 */
export function saidUnder18(): boolean {
  return declaresMinor(readFunnel().answers) || flaggedUnder18();
}

/**
 * Whether this document must load no tracking at all: the /not-eligible page itself,
 * and any page in a tab that has said the visitor is under 18 (`saidUnder18`) - a
 * refresh, the back button, or "Back to home" from /not-eligible would otherwise load
 * GTM and HubSpot for them again.
 *
 * Read from the store directly rather than through `useFunnel`, whose first value is
 * the empty server snapshot: TrackingScripts only renders once consent has been read
 * in the browser, so the store is always readable here.
 */
export function trackingBlocked(pathname: string | null): boolean {
  return pathname === NOT_ELIGIBLE_PATH || saidUnder18();
}

/**
 * For a page the browser restores from its back/forward cache. A restored page is the
 * old document, scripts and all: back from /not-eligible can bring back the quiz page
 * with GTM or HubSpot still running in it, after the answers have said under 18. Such
 * a page reloads, and the fresh one loads nothing (`trackingBlocked`).
 */
export function reloadIfTrackingSurvived(): void {
  const w = window as Window & { dataLayer?: unknown; _hsq?: unknown; google_tag_manager?: unknown };
  const running = Array.isArray(w.dataLayer) || w.google_tag_manager !== undefined || w._hsq !== undefined;
  if (running && trackingBlocked(window.location.pathname)) reloadPage();
}
