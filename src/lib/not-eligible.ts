"use client";

import { reloadPage, updateGoogleConsent } from "./consent";
import { NOT_ELIGIBLE_PATH } from "./funnel";
import { readFunnel } from "./funnel-state";
import { declaresMinor } from "./quiz";

/**
 * Sends someone who answered "Under 18" to /not-eligible, with a full page load.
 *
 * Not `router.push`: a client-side navigation keeps the current document, and with it
 * any tags GTM has already started — Google's own engagement and scroll events would
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
  updateGoogleConsent({ analytics: false, marketing: false });
  if (mode === "replace") location.replace(NOT_ELIGIBLE_PATH);
  else location.assign(NOT_ELIGIBLE_PATH);
}

/**
 * Whether this document must load no tracking at all: the /not-eligible page itself,
 * and any page in a tab whose stored answers say the visitor is under 18 — a refresh,
 * the back button, or "Back to home" from /not-eligible would otherwise load GTM and
 * HubSpot for them again.
 *
 * Read from the store directly rather than through `useFunnel`, whose first value is
 * the empty server snapshot: TrackingScripts only renders once consent has been read
 * in the browser, so the store is always readable here.
 */
export function trackingBlocked(pathname: string | null): boolean {
  return pathname === NOT_ELIGIBLE_PATH || declaresMinor(readFunnel().answers);
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
