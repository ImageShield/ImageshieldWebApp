import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackAnswer, trackComplete, trackStart } from "./analytics";
import { definitionOf } from "./analytics.fixtures";
import { captureAttribution, getAttribution, resetAttributionLoad } from "./attribution";
import { writeConsent } from "./consent";
import { syncQuizVersion, writeFunnel } from "./funnel-state";

vi.mock("./analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: false }));

const V = "likeness-health-v11";
const DEFINITION = definitionOf(V);
const ANSWERS = {
  age: "25-34",
  gender: "Non-Binary",
  platforms: ["TikTok", "X (Twitter)", "Instagram"],
  posting_volume: "Weekly",
  prior_misuse: "Once or twice",
  discovery_method: "I subscribe to a likeness detection/monitoring service",
};
const ALL =
  "page_variant=v3&utm_source=google&utm_medium=cpc&utm_campaign=campaign_name&utm_content=ad_name&utm_term=keyword&gclid=example&fbclid=fb1&msclkid=ms1";
/** What ALL puts on an event: all nine, the click IDs included. */
const NINE_V3 = {
  page_variant: "v3",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "campaign_name",
  utm_content: "ad_name",
  utm_term: "keyword",
  gclid: "example",
  fbclid: "fb1",
  msclkid: "ms1",
};
const NINE_KEYS = Object.keys(NINE_V3);

/** The events only (each is followed by an event-less reset push), as JSON would carry them. */
const events = () =>
  JSON.parse(
    JSON.stringify(
      ((window as Window & { dataLayer?: Record<string, unknown>[] }).dataLayer ?? []).filter((e) => "event" in e),
    ),
  ) as Record<string, unknown>[];
const layer = () => (window as Window & { dataLayer?: Record<string, unknown>[] }).dataLayer!;

const ANSWERS_SO_FAR = (upTo: string) => {
  const keys = DEFINITION.questions.map((q) => q.key);
  return Object.fromEntries(Object.entries(ANSWERS).filter(([k]) => keys.indexOf(k) <= keys.indexOf(upTo)));
};
/** Runs the whole quiz through the real helpers, the way QuizFlow calls them. */
function playQuiz() {
  trackStart(DEFINITION, "age");
  for (const q of DEFINITION.questions) {
    writeFunnel({ quizVersion: V, answers: { ...ANSWERS_SO_FAR(q.key) } });
    trackAnswer(DEFINITION, q.key);
  }
  trackComplete(DEFINITION);
}

/** What one event carries of attribution when a visit arrives with just this query. */
function sentFor(search: string) {
  captureAttribution(search);
  trackStart(DEFINITION, "age");
  return events()[0];
}

beforeEach(() => {
  document.cookie = "imageshield_consent=; Max-Age=0; Path=/";
  writeFunnel({ answers: {} });
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  resetAttributionLoad();
  writeConsent({ analytics: true, marketing: false });
  vi.stubGlobal("dataLayer", []);
  writeFunnel({ quizVersion: V, answers: {} });
});

afterEach(() => vi.unstubAllGlobals());

describe("all nine fields on the three events", () => {
  it("is on quiz_start, with the existing fields intact", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    expect(events()).toStrictEqual([{ event: "quiz_start", quiz_version: V, question_number: 1, ...NINE_V3 }]);
  });

  it("is on quiz_answer, with the existing fields intact", () => {
    captureAttribution(ALL);
    writeFunnel({ answers: { age: "25-34" } });
    trackAnswer(DEFINITION, "age");
    expect(events().find((e) => e.event === "quiz_answer")).toStrictEqual({
      event: "quiz_answer",
      quiz_version: V,
      question: "age",
      question_number: 1,
      ...NINE_V3,
    });
  });

  it("is on quiz_complete, with the existing fields intact", () => {
    captureAttribution(ALL);
    writeFunnel({ answers: ANSWERS });
    trackComplete(DEFINITION);
    expect(events().find((e) => e.event === "quiz_complete")).toStrictEqual({
      event: "quiz_complete",
      quiz_version: V,
      question_count: 6,
      ...NINE_V3,
    });
  });

  it("is on every event of a whole quiz, and each event is sent once", () => {
    captureAttribution(ALL);
    playQuiz();
    const sent = events();
    expect(sent.map((e) => e.event)).toStrictEqual([
      "quiz_start",
      ...DEFINITION.questions.map(() => "quiz_answer"),
      "quiz_complete",
    ]);
    for (const e of sent) expect(e).toMatchObject(NINE_V3);
    /* Replaying the same calls - a reload, a re-render, a step back - adds nothing. */
    playQuiz();
    expect(events()).toHaveLength(sent.length);
  });

  it.each(["original", "v2", "v3", "v4", "v5"])("carries the valid variant %s", (variant) => {
    expect(sentFor(`page_variant=${variant}`)).toMatchObject({ page_variant: variant });
  });

  it("says direct, and nothing more, for a visitor who arrived with no attribution", () => {
    trackStart(DEFINITION, "age");
    expect(events()).toStrictEqual([
      { event: "quiz_start", quiz_version: V, question_number: 1, page_variant: "direct" },
    ]);
  });

  it("says direct for an invalid variant, and still carries the other fields", () => {
    expect(sentFor("page_variant=v9&utm_source=google")).toMatchObject({
      page_variant: "direct",
      utm_source: "google",
    });
  });

  it("sends no null for a field the visit lacked", () => {
    const e = sentFor("page_variant=v2&gclid=abc");
    expect(e).toMatchObject({ page_variant: "v2", gclid: "abc" });
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "msclkid"]) {
      expect(e).not.toHaveProperty(k);
    }
    expect(JSON.stringify(layer())).not.toContain("null");
  });

  it("clears all nine after each event so GTM doesn't hold them for other tags", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    const reset = layer()[layer().length - 1];
    expect("event" in reset).toBe(false);
    for (const key of NINE_KEYS) expect(reset).toHaveProperty(key, undefined);
  });
});

describe("which values are sent", () => {
  it.each([
    ["a campaign name", "utm_campaign", "spring_sale-2026"],
    ["a campaign with spaces", "utm_campaign", "spring sale 2026"],
    ["a dotted source", "utm_source", "news.example.com"],
    ["a keyword with a plus", "utm_term", "likeness+protection"],
    ["a non-latin name", "utm_content", "café déjà-vu"],
    ["a gclid", "gclid", "Cj0KCQiA3-uMBhDqARIsAD4XHpf_x3Q9-aZ"],
    ["an fbclid", "fbclid", "IwAR2x_Yz-0123456789abcdef"],
    ["an msclkid", "msclkid", "3b6e0c1a2d4f4e8f9a7b5c6d7e8f9012"],
    ["exactly 100 characters", "utm_campaign", "a".repeat(100)],
  ])("sends %s", (_label, field, value) => {
    expect(sentFor(`page_variant=v2&${field}=${encodeURIComponent(value)}`)).toMatchObject({ [field]: value });
  });

  it.each([
    ["an email address", "utm_term", "jane.doe@example.com"],
    ["an email in a click ID field", "gclid", "jane@example.com"],
    ["101 characters", "utm_campaign", "a".repeat(101)],
    ["a click ID over 100 characters", "gclid", "g".repeat(150)],
    ["a still-encoded value", "utm_content", "50%25off"],
    ["a pasted URL", "utm_campaign", "https://evil.example/?a=1&b=2"],
    ["a slash", "utm_medium", "cpc/paid"],
    ["a quote", "utm_campaign", 'say"hi'],
    ["angle brackets", "utm_content", "<script>alert(1)</script>"],
    ["an equals sign", "utm_term", "a=b"],
    ["a semicolon", "utm_campaign", "a;b"],
    ["a backslash", "utm_campaign", "a\\b"],
    ["a phone-style symbol", "utm_term", "(555) 010-0100#"],
  ])("leaves out %s, and sends the rest of the event", (_label, field, value) => {
    const e = sentFor(`page_variant=v4&utm_source=google&${field}=${encodeURIComponent(value)}`);
    expect(e).not.toHaveProperty(field);
    expect(e).toMatchObject({ page_variant: "v4", utm_source: "google" });
  });

  it("never lets a control character reach the dataLayer (the parser strips it before storage)", () => {
    const e = sentFor("page_variant=v2&utm_campaign=ab%07c%00d%0Ae");
    expect(e).toMatchObject({ utm_campaign: "abcde" });
    expect(JSON.stringify(layer())).not.toMatch(/[\u0000-\u001f]/);
  });

  it("drops an over-long value instead of cutting it to 100", () => {
    const e = sentFor(`page_variant=v2&utm_campaign=${"x".repeat(150)}`);
    expect(e).not.toHaveProperty("utm_campaign");
    expect(JSON.stringify(layer())).not.toContain("xxxxxxxxxx");
  });

  it("leaves out empty and whitespace values", () => {
    const e = sentFor("page_variant=v2&utm_source=&utm_medium=%20%20&gclid=");
    for (const k of ["utm_source", "utm_medium", "gclid"]) expect(e).not.toHaveProperty(k);
    expect(e).toMatchObject({ page_variant: "v2" });
  });

  it("still sends the variant when every other value is refused", () => {
    const e = sentFor(`page_variant=v5&utm_source=a@b.co&gclid=${"z".repeat(200)}`);
    expect(e).toStrictEqual({ event: "quiz_start", quiz_version: V, question_number: 1, page_variant: "v5" });
  });

  it("never holds a refused value, so it cannot reach the dataLayer by another route", () => {
    captureAttribution("page_variant=v2&utm_term=jane%40example.com");
    expect(getAttribution()).toStrictEqual({ page_variant: "v2" });
    expect(window.sessionStorage.getItem("imageshield.attribution.v1")).not.toContain("jane");
    trackStart(DEFINITION, "age");
    expect(JSON.stringify(layer())).not.toContain("jane");
  });
});

describe("consent and under-18, unchanged", () => {
  it("sends nothing without analytics consent", () => {
    writeConsent({ analytics: false, marketing: false });
    captureAttribution(ALL);
    playQuiz();
    expect(events()).toStrictEqual([]);
  });

  it("sends nothing when no container has loaded", () => {
    vi.unstubAllGlobals();
    captureAttribution(ALL);
    expect(() => playQuiz()).not.toThrow();
    expect((window as Window & { dataLayer?: unknown }).dataLayer).toBeUndefined();
  });

  it("sends nothing for an under-18 answer", () => {
    captureAttribution(ALL);
    writeFunnel({ answers: { age: "Under 18" } });
    trackStart(DEFINITION, "age");
    trackAnswer(DEFINITION, "age");
    expect(events()).toStrictEqual([]);
  });

  it("sends nothing for the rest of a quiz once the age answer was under 18", () => {
    captureAttribution(ALL);
    writeFunnel({ answers: { age: "Under 18", gender: "Non-Binary" } });
    window.sessionStorage.setItem("imageshield.under18", "1");
    trackAnswer(DEFINITION, "gender");
    trackComplete(DEFINITION);
    expect(events()).toStrictEqual([]);
  });
});

describe("freezing at quiz start", () => {
  it("lets attribution change before the quiz starts: first touch before start", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    captureAttribution("page_variant=v5&utm_source=meta");
    trackStart(DEFINITION, "age");
    expect(events()[0]).toMatchObject({ page_variant: "v5", utm_source: "meta" });
  });

  it("freezes at quiz_start: a later URL cannot replace it, before any answer", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    captureAttribution("page_variant=v5&utm_source=meta&gclid=other");
    expect(getAttribution()).toMatchObject({ page_variant: "v3", utm_source: "google", gclid: "example" });
  });

  it("freezes even with analytics consent denied", () => {
    writeConsent({ analytics: false, marketing: false });
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    expect(events()).toStrictEqual([]);
    captureAttribution("page_variant=v5");
    expect(getAttribution().page_variant).toBe("v3");
  });

  it("freezes even when no container has loaded", () => {
    vi.unstubAllGlobals();
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    captureAttribution("page_variant=v5");
    expect(getAttribution().page_variant).toBe("v3");
  });

  it("freezes for an under-18 visitor, whose events are dropped", () => {
    captureAttribution(ALL);
    writeFunnel({ answers: { age: "Under 18" } });
    trackStart(DEFINITION, "age");
    captureAttribution("page_variant=v5");
    expect(getAttribution().page_variant).toBe("v3");
  });

  it("freezes on a repeat start, which sends nothing new", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    trackStart(DEFINITION, "age");
    trackStart(DEFINITION, "gender");
    expect(events()).toHaveLength(1);
    captureAttribution("page_variant=v5");
    expect(getAttribution().page_variant).toBe("v3");
  });

  it("freezes a deep link to a question on that link's attribution", () => {
    window.history.replaceState(null, "", `/quiz/questions?q=4&${ALL}`);
    resetAttributionLoad();
    trackStart(DEFINITION, "posting_volume");
    expect(events()[0]).toMatchObject(NINE_V3);
  });

  it("keeps the frozen attribution across a refresh on a different URL", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    window.history.replaceState(null, "", "/quiz/questions?q=1&page_variant=v5&utm_source=meta");
    resetAttributionLoad(); // a new page load
    expect(getAttribution()).toMatchObject({ page_variant: "v3", utm_source: "google" });
  });

  it("keeps it when a changed quiz version clears the answers", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    writeFunnel({ quizVersion: V, answers: { age: "25-34" } });
    syncQuizVersion("likeness-health-v99"); // wipes the answers
    expect(Object.keys(writeFunnel({}).answers)).toHaveLength(0);
    captureAttribution("page_variant=v5&utm_source=meta");
    expect(getAttribution()).toMatchObject({ page_variant: "v3", utm_source: "google" });
  });

  it("puts one snapshot on every event of the funnel even if the URL changes mid-quiz", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    for (const q of DEFINITION.questions) {
      writeFunnel({ quizVersion: V, answers: { ...ANSWERS_SO_FAR(q.key) } });
      /* Every step, the address bar is a different campaign. */
      window.history.replaceState(null, "", `/quiz/questions?q=1&page_variant=v5&utm_source=step_${q.key}`);
      resetAttributionLoad();
      captureAttribution(`page_variant=v5&utm_source=step_${q.key}`);
      trackAnswer(DEFINITION, q.key);
    }
    trackComplete(DEFINITION);
    const sent = events();
    expect(sent.length).toBeGreaterThan(2);
    for (const e of sent) expect(e).toMatchObject(NINE_V3);
  });

  it("freezes a new tab independently: nothing stored means a fresh capture", () => {
    captureAttribution(ALL);
    trackStart(DEFINITION, "age");
    window.sessionStorage.clear(); // a new tab
    resetAttributionLoad();
    expect(captureAttribution("page_variant=v5&utm_source=meta")).toMatchObject({ page_variant: "v5" });
  });
});
