/**
 * "General recommendations" — served by the API, rendered as served.
 *
 * `general_recommendations` sits at the top level of the score envelope, beside
 * `scope_note`: at most three, already in the order they are meant to be read, and the
 * same for every visitor. Every word was drafted from cited sources and approved by an
 * operator, so nothing here rewrites, supplements or reorders them. An empty or absent
 * list hides the card.
 *
 * Client-safe: the screen renders straight from it.
 */

export type RecommendationLink = {
  url: string;
  /** Null when the research gave the page no name of its own — see `linkText`. */
  label: string | null;
};

export type GeneralRecommendation = {
  /** An instruction. Rendered as served. */
  title: string;
  /** One sentence. Rendered as served. */
  body: string;
  /** A page the research cited, opened in a new tab. */
  link: RecommendationLink | null;
};

/**
 * The served list, checked against the contract on its way in.
 *
 * Checked rather than trusted because `call<T>` types an answer by assertion, so this
 * is the first place a missing field can surface — and unchecked it surfaces as a
 * crash on `.map` for every visitor, if this ships ahead of the API. Anything but a
 * list reads as none. An entry with no title or body is dropped rather than drawn as
 * a blank row; one with a bad link keeps its words and loses only the link. Nothing
 * is reordered.
 */
export function recommendationsFrom(raw: unknown): GeneralRecommendation[] {
  if (!Array.isArray(raw)) {
    console.warn("score response: general_recommendations is not a list; card hidden");
    return [];
  }

  const kept: GeneralRecommendation[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { title, body, link } = entry as Record<string, unknown>;
    if (!isFilled(title) || !isFilled(body)) continue;
    kept.push({ title, body, link: linkFrom(link) });
  }
  if (kept.length < raw.length) {
    console.warn(
      `score response: dropped ${raw.length - kept.length} malformed general_recommendations`,
    );
  }
  return kept;
}

/**
 * The link, when it can be followed safely, else none.
 *
 * Absolute http(s) only. The string goes straight into an `href`: a relative one
 * would resolve against quiz.imageshield.com and send the visitor somewhere on this
 * site the research never cited, and a `javascript:` one would run in this origin.
 */
function linkFrom(raw: unknown): RecommendationLink | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { url, label } = raw as Record<string, unknown>;
  if (typeof url !== "string") return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  /* A blank label is no label: it would draw a link with nothing to click or read. */
  return { url: parsed.href, label: isFilled(label) ? label : null };
}

/**
 * What the link says: the research's own name for the page, or else the page's host.
 *
 * The host rather than "Learn more" because a screen reader can list every link on
 * the page out of context, and three "Learn more"s say nothing about where each goes.
 * It is also the one wording that invents nothing.
 */
export function linkText(link: RecommendationLink): string {
  return link.label ?? new URL(link.url).hostname.replace(/^www\./, "");
}

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
