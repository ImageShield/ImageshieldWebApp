"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's cookie choice for this site, kept in a first-party cookie.
 *
 * A cookie rather than localStorage because it expires by itself: the banner asks
 * again after six months instead of one click deciding forever. Host-only (no
 * `Domain`), so a choice made on the quiz decides nothing for imageshield.com.
 *
 * Read in the browser only. The server never sees it: reading cookies in the root
 * layout would turn every static screen into a per-request render. So the server
 * renders "not known yet", and the real answer arrives with hydration.
 */
const COOKIE = "imageshield_consent";
/** Bump to ask everyone again — when a vendor is added or the categories change. */
const VERSION = "v1";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

export type Consent = {
  /** Google Tag Manager, and Google Analytics through it. */
  analytics: boolean;
  /** HubSpot, and Google's advertising signals. */
  marketing: boolean;
};

/** The server render and hydration: the cookie hasn't been read yet. */
export const PENDING = "pending";

/** `null` is a visitor who hasn't chosen, or chose under an older `VERSION`. */
export function parseConsent(value: string | undefined): Consent | null {
  const parts = (value ?? "").split(".");
  if (parts.length !== 3) return null;
  const [version, analytics, marketing] = parts;
  if (version !== VERSION || !/^a[01]$/.test(analytics) || !/^m[01]$/.test(marketing)) {
    return null;
  }
  return { analytics: analytics === "a1", marketing: marketing === "m1" };
}

export function serializeConsent(consent: Consent): string {
  return `${VERSION}.a${consent.analytics ? 1 : 0}.m${consent.marketing ? 1 : 0}`;
}

function cookieValue(name: string): string | undefined {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

const listeners = new Set<() => void>();

/**
 * useSyncExternalStore compares snapshots by identity, so the parsed object is kept
 * until the cookie's own value changes — not the whole cookie string, which Google
 * and HubSpot rewrite on their own schedule.
 */
let last: { value: string | undefined; consent: Consent | null } = {
  value: undefined,
  consent: null,
};

export function readConsent(): Consent | null {
  const value = cookieValue(COOKIE);
  if (value !== last.value) last = { value, consent: parseConsent(value) };
  return last.consent;
}

export function writeConsent(consent: Consent): void {
  // `Secure` would stop the cookie being set at all on http://localhost in Safari.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${serializeConsent(consent)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useConsent(): Consent | null | typeof PENDING {
  return useSyncExternalStore<Consent | null | typeof PENDING>(
    subscribe,
    readConsent,
    () => PENDING,
  );
}

/** Google's consent-mode signals for a choice. */
export function googleConsent(consent: Consent) {
  const ads = consent.marketing ? "granted" : "denied";
  return {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
  };
}

/**
 * Tells a container already running on this page about a changed choice.
 *
 * Pushes an `arguments` object, the way `gtag()` does: GTM only treats that shape as
 * a consent command, and silently ignores the same values pushed as an array.
 */
export function updateGoogleConsent(consent: Consent): void {
  const w = window as Window & { dataLayer?: unknown[] };
  if (!w.dataLayer) return;
  const dataLayer = w.dataLayer;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the values travel in `arguments`
  (function gtag(..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params -- see above: it must be `arguments`
    dataLayer.push(arguments);
  })("consent", "update", googleConsent(consent));
}

const ANALYTICS_COOKIES = /^(_ga|_gid|_gat)/;
const MARKETING_COOKIES = /^(_gcl_|__hstc$|__hssc$|__hssrc$|hubspotutk$|messagesUtk$)/;

/**
 * Deletes what Google and HubSpot stored, for this host, under a category the
 * visitor has just withdrawn.
 *
 * Only the quiz's own scope — host-only cookies and ones set for this exact host —
 * never a parent domain. `document.cookie` can't say which domain a cookie belongs
 * to, and a `_ga` on `.imageshield.com` is imageshield.com's own: its GA4 property
 * writes one there, so expiring every parent domain reset that site's analytics
 * too. Whatever the quiz's tags store has to stay host-scoped for this to reach it.
 */
export function clearTrackingCookies(withdrawn: Consent): void {
  const host = window.location.hostname;
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=")[0];
    const match =
      (withdrawn.analytics && ANALYTICS_COOKIES.test(name)) ||
      (withdrawn.marketing && MARKETING_COOKIES.test(name));
    if (!match) continue;
    for (const domain of ["", `; Domain=${host}`]) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }
}

/** A script already running can't be unloaded, so a withdrawal ends with a reload. */
export function reloadPage(): void {
  window.location.reload();
}
