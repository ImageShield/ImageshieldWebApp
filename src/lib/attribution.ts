"use client";

import { readFunnel } from "./funnel-state";

/**
 * Where a visitor came from, for the landing-page A/B test. Analytics only: it rides on
 * the quiz's three dataLayer events and goes nowhere else.
 *
 * The marketing site (imageshield.com) and this app are different origins, so nothing
 * stored over there is readable here: its landing pages put these parameters on the link
 * to the quiz, and this module is the one place that reads them.
 *
 * Capture. The first load of a tab reads them from the URL and keeps the result in
 * sessionStorage, so refreshes, `?q=` steps and every route after the first see the same
 * object. Nothing else parses the URL.
 *
 * Session. The tab: sessionStorage is per tab and dies with it, the same span the
 * funnel's own answers live for. A new tab captures afresh.
 *
 * Precedence. First touch wins. Once stored, attribution is not replaced by empty
 * parameters, by `direct`, or by a different campaign - with one exception: a URL that
 * carries real attribution replaces what is stored while the quiz has not started.
 * Someone who lands from one ad, leaves and clicks another in the same tab before the
 * first question is counted against the ad that actually brought them to the quiz.
 *
 * Freezing. The quiz starts when the first question is put in front of the visitor
 * (`quiz_start`, sent once per tab). `freezeAttribution` is called then, and from that
 * moment attribution is immutable for the tab: a changed URL, a refresh, or a
 * quiz-version change that wipes the answers cannot rewrite it. The freeze is a flag of
 * its own, independent of consent and of the answers, so `quiz_start`, `quiz_answer` and
 * `quiz_complete` all carry the one snapshot.
 */

const PAGE_VARIANTS = ["original", "v2", "v3", "v4", "v5", "direct"] as const;
type PageVariant = (typeof PAGE_VARIANTS)[number];

const CAMPAIGN_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "msclkid",
] as const;

/** `page_variant` always; each other field only when the visit had it and it is fit to send. */
export type Attribution = { page_variant: PageVariant } & Partial<
  Record<(typeof CAMPAIGN_FIELDS)[number], string>
>;

const KEY = "imageshield.attribution.v1";
/** Set when the quiz starts. Its own key, so it outlives anything the funnel store clears. */
const FROZEN_KEY = "imageshield.attribution.frozen.v1";

export const DIRECT: Attribution = { page_variant: "direct" };

/**
 * What a value may be. These parameters are free text typed into a link by whoever builds
 * it, and a dataLayer value goes to Google, so a value is kept only if it looks like what
 * the parameter is for: letters and digits of any script, spaces, and `_ - . ~ + :`. That
 * admits campaign names (`spring sale 2026`, `q4-brand_search`) and every ad platform's
 * click ID, and refuses what makes a value something else - `@` (an email address), `%`
 * (still encoded), quotes, slashes, `=` and `&` (a pasted URL), angle brackets. Over 100
 * characters is refused outright, never cut: GA4 keeps 100 characters of a parameter
 * value, and a truncated click ID would pass for a real one.
 *
 * This can't tell a name from a digit string, so it is a guard against careless links,
 * not a promise about what a link-builder typed.
 */
const VALUE = /^[\p{L}\p{N} _.~+:-]{1,100}$/u;

/** A value fit to send - trimmed, free of control characters - or undefined. */
function clean(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return VALUE.test(value) ? value : undefined;
}

/** Case-insensitive, so `?page_variant=V3` is v3. Missing or unknown is `direct`. */
export function normalizePageVariant(raw: unknown): PageVariant {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return PAGE_VARIANTS.find((v) => v === value) ?? "direct";
}

/** The attribution an object of raw values carries; used for the URL and for storage. */
function fromRaw(get: (field: string) => unknown): Attribution {
  const a: Attribution = { page_variant: normalizePageVariant(get("page_variant")) };
  for (const field of CAMPAIGN_FIELDS) {
    const value = clean(get(field));
    if (value !== undefined) a[field] = value;
  }
  return a;
}

/** The attribution a query string carries. `URLSearchParams` has decoded it already. */
export function parseAttribution(search: string): Attribution {
  const params = new URLSearchParams(search);
  return fromRaw((field) => params.get(field));
}

/**
 * Whether this says anything about where the visitor came from. A bare `direct`, an
 * invalid variant and an empty `?utm_source=` all say nothing, and so can never
 * displace what is stored.
 */
function hasSignal(a: Attribution): boolean {
  return a.page_variant !== "direct" || CAMPAIGN_FIELDS.some((f) => a[f] !== undefined);
}

/* Hold what sessionStorage couldn't (private mode, quota), for this page's life. */
let inMemory: Attribution | null = null;
let inMemoryFrozen = false;

function readStored(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      /* Validated again rather than trusted: storage is editable from the console. */
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return fromRaw((field) => parsed[field]);
    }
  } catch {
    // Unreadable or unavailable: fall through to what this page held in memory.
  }
  return inMemory;
}

function store(a: Attribution): void {
  inMemory = a;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // Storage unavailable - the quiz still works, attribution just won't survive a reload.
  }
}

function isFrozen(): boolean {
  if (inMemoryFrozen) return true;
  try {
    return window.sessionStorage.getItem(FROZEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether the quiz has begun, and attribution may no longer change. The freeze flag is
 * the rule; an answer on record is honoured as well, so a tab that began its quiz before
 * the flag existed (a deploy mid-session) is held too.
 */
const quizStarted = () => isFrozen() || Object.keys(readFunnel().answers).length > 0;

/**
 * Reads the URL's attribution into the store, under the precedence above, and returns
 * what is stored afterwards. Idempotent: calling it again with the same search changes
 * nothing.
 */
export function captureAttribution(search: string): Attribution {
  const incoming = parseAttribution(search);
  const stored = readStored();
  if (stored === null || (hasSignal(incoming) && !quizStarted())) {
    store(incoming);
    return incoming;
  }
  return stored;
}

/**
 * Makes attribution immutable for this tab. Called when the quiz starts, for every
 * visitor: it is not an analytics call and does not look at consent, the dataLayer or
 * whether `quiz_start` was actually pushed.
 *
 * The current URL is captured first, so a visitor who deep-links straight to a question
 * is frozen on that link's attribution rather than on nothing. Idempotent.
 */
export function freezeAttribution(): void {
  if (typeof window === "undefined") return;
  getAttribution();
  inMemoryFrozen = true;
  try {
    window.sessionStorage.setItem(FROZEN_KEY, "1");
  } catch {
    // Storage unavailable - held for this page's life by the flag above.
  }
}

/* The URL is read once per page load. Later calls in the same load - and every client
   navigation, which never carries these parameters - just read the store. */
let capturedThisLoad = false;

/**
 * The current attribution, always an object: `direct` with nothing else when the visitor
 * arrived without any. Captures from the address bar on its first call in a page load,
 * so a caller never has to know whether the capture component has mounted yet.
 */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return DIRECT;
  if (!capturedThisLoad) {
    capturedThisLoad = true;
    return captureAttribution(window.location.search);
  }
  return readStored() ?? captureAttribution("");
}

/** Re-arms the once-per-load capture. For tests, which simulate a fresh page load. */
export function resetAttributionLoad(): void {
  capturedThisLoad = false;
  inMemory = null;
  inMemoryFrozen = false;
}
