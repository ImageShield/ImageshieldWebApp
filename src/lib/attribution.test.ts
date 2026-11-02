import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureAttribution,
  DIRECT,
  freezeAttribution,
  getAttribution,
  normalizePageVariant,
  parseAttribution,
  resetAttributionLoad,
} from "./attribution";
import { writeFunnel } from "./funnel-state";

const ALL =
  "page_variant=v3&utm_source=google&utm_medium=cpc&utm_campaign=campaign_name&utm_content=ad_name&utm_term=keyword&gclid=example&fbclid=fb1&msclkid=ms1";

/** A fresh page load at this address: what the browser does on a refresh or a redirect. */
const loadAt = (url: string) => {
  window.history.replaceState(null, "", url);
  resetAttributionLoad();
};

beforeEach(() => {
  window.sessionStorage.clear();
  /* The funnel store caches in memory, so clearing storage alone leaves answers behind. */
  writeFunnel({ answers: {} });
  window.sessionStorage.clear();
  loadAt("/");
});

describe("parsing the incoming URL", () => {
  it.each(["original", "v2", "v3", "v4", "v5"])("keeps the valid variant %s", (variant) => {
    expect(parseAttribution(`page_variant=${variant}`).page_variant).toBe(variant);
  });

  it("is direct with no parameters at all", () => {
    expect(parseAttribution("")).toStrictEqual(DIRECT);
  });

  it("is direct for an explicit direct, and not changed by it", () => {
    expect(parseAttribution("page_variant=direct").page_variant).toBe("direct");
  });

  it("has only the variant when the other parameters are missing", () => {
    expect(parseAttribution("page_variant=v4")).toStrictEqual({ page_variant: "v4" });
  });

  it("reads all nine parameters", () => {
    expect(parseAttribution(ALL)).toStrictEqual({
      page_variant: "v3",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "campaign_name",
      utm_content: "ad_name",
      utm_term: "keyword",
      gclid: "example",
      fbclid: "fb1",
      msclkid: "ms1",
    });
  });

  it.each(["v9", "v1", "V", "nonsense", "", "null", "undefined"])(
    "turns the invalid variant %j into direct",
    (variant) => {
      expect(parseAttribution(`page_variant=${variant}`).page_variant).toBe("direct");
    },
  );

  it("does not turn a valid variant into direct, whatever its case or padding", () => {
    expect(normalizePageVariant("V3")).toBe("v3");
    expect(normalizePageVariant("  Original ")).toBe("original");
    expect(normalizePageVariant("V5")).toBe("v5");
  });

  it("decodes encoded characters", () => {
    const a = parseAttribution(
      "page_variant=v2&utm_campaign=spring%20sale%202026&utm_term=likeness%2Bprotection&utm_source=caf%C3%A9",
    );
    expect(a.utm_campaign).toBe("spring sale 2026");
    expect(a.utm_term).toBe("likeness+protection");
    expect(a.utm_source).toBe("café");
  });

  it("treats an empty or whitespace value as missing", () => {
    const a = parseAttribution("page_variant=v2&utm_source=&utm_medium=%20%20&gclid=");
    expect(a).toStrictEqual({ page_variant: "v2" });
  });

  it("strips control characters", () => {
    expect(parseAttribution("utm_medium=a%00b%0Ac").utm_medium).toBe("abc");
  });

  it("keeps a value of exactly 100 characters and drops one of 101, never cutting it", () => {
    expect(parseAttribution(`gclid=${"x".repeat(100)}`).gclid).toHaveLength(100);
    expect(parseAttribution(`gclid=${"x".repeat(101)}`)).toStrictEqual(DIRECT);
    expect(parseAttribution(`utm_source=${"x".repeat(1000)}`)).toStrictEqual(DIRECT);
  });

  it("drops an email-like or symbol-laden value, and keeps the rest", () => {
    expect(
      parseAttribution("page_variant=v2&utm_term=a%40b.co&utm_content=a%2Fb&utm_source=a%26b%3D1&utm_medium=%3Cb%3E&gclid=ok-1_2"),
    ).toStrictEqual({ page_variant: "v2", gclid: "ok-1_2" });
  });

  it("keeps ad-platform click IDs and campaign names whole", () => {
    const a = parseAttribution(
      "utm_campaign=q4-brand_search.2026&gclid=Cj0KCQiA_x-9BhDsARIsAHZwR&fbclid=IwAR0_abc-123&msclkid=a1b2c3d4e5f6",
    );
    expect(a).toMatchObject({ utm_campaign: "q4-brand_search.2026", gclid: "Cj0KCQiA_x-9BhDsARIsAHZwR" });
  });

  it("ignores parameters that are not attribution", () => {
    expect(parseAttribution("q=3&foo=bar")).toStrictEqual(DIRECT);
  });
});

describe("persistence", () => {
  it("survives moving between quiz steps", () => {
    loadAt(`/quiz/questions?q=1&${ALL}`);
    const first = getAttribution();
    /* Client navigation: the URL changes, the page load doesn't. */
    window.history.pushState(null, "", "/quiz/questions?q=2");
    expect(getAttribution()).toStrictEqual(first);
    window.history.pushState(null, "", "/details");
    expect(getAttribution()).toStrictEqual(first);
    expect(first.page_variant).toBe("v3");
  });

  it("survives a refresh, where the URL no longer carries it", () => {
    loadAt(`/quiz?${ALL}`);
    const first = getAttribution();
    loadAt("/quiz/questions?q=4");
    expect(getAttribution()).toStrictEqual(first);
  });

  it("survives full page loads across routes (/ to /quiz to /otp)", () => {
    loadAt("/?page_variant=v5&utm_source=meta");
    getAttribution();
    loadAt("/quiz?page_variant=v5&utm_source=meta");
    getAttribution();
    loadAt("/otp");
    expect(getAttribution().page_variant).toBe("v5");
    expect(getAttribution().utm_source).toBe("meta");
  });

  it("does not let empty parameters overwrite stored attribution", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    expect(captureAttribution("page_variant=&utm_source=&utm_medium=")).toMatchObject({
      page_variant: "v2",
      utm_source: "google",
    });
  });

  it("does not replace stored attribution with direct, before or after answers", () => {
    captureAttribution("page_variant=v4&utm_campaign=c");
    expect(captureAttribution("").page_variant).toBe("v4");
    expect(captureAttribution("page_variant=direct").page_variant).toBe("v4");
    expect(captureAttribution("page_variant=bogus").page_variant).toBe("v4");
    writeFunnel({ answers: { age: "25-34" } });
    expect(captureAttribution("").page_variant).toBe("v4");
    expect(captureAttribution("page_variant=direct").page_variant).toBe("v4");
  });

  it("stores direct for a visit with nothing, so the object always exists", () => {
    expect(getAttribution()).toStrictEqual(DIRECT);
    expect(JSON.parse(window.sessionStorage.getItem("imageshield.attribution.v1")!)).toStrictEqual(DIRECT);
  });

  it("repairs a tampered stored value rather than trusting it", () => {
    window.sessionStorage.setItem(
      "imageshield.attribution.v1",
      JSON.stringify({ page_variant: "v99", utm_source: 5, gclid: "ok", extra: "x" }),
    );
    expect(getAttribution()).toStrictEqual({ ...DIRECT, gclid: "ok" });
  });

  it("does not trust a stored value that would not have been captured", () => {
    window.sessionStorage.setItem(
      "imageshield.attribution.v1",
      JSON.stringify({ page_variant: "v2", utm_term: "person@example.com", utm_source: "x".repeat(101) }),
    );
    expect(getAttribution()).toStrictEqual({ page_variant: "v2" });
  });

  it("copes with unreadable storage", () => {
    window.sessionStorage.setItem("imageshield.attribution.v1", "{not json");
    expect(() => getAttribution()).not.toThrow();
  });
});

describe("precedence between sessions and the first answer", () => {
  it("captures new attribution in a new session (nothing stored)", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    window.sessionStorage.clear(); // a new tab
    expect(captureAttribution("page_variant=v5&utm_source=meta")).toMatchObject({
      page_variant: "v5",
      utm_source: "meta",
    });
  });

  it("replaces attribution on a signal before the first answer: the visitor clicked another ad", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    expect(captureAttribution("page_variant=v5&utm_source=meta")).toMatchObject({
      page_variant: "v5",
      utm_source: "meta",
    });
  });

  it("replaces whole, not field by field, so two campaigns are never blended", () => {
    captureAttribution("page_variant=v2&utm_source=google&utm_campaign=a&gclid=g1");
    const next = captureAttribution("page_variant=v3&utm_source=meta");
    expect(next).toStrictEqual({ page_variant: "v3", utm_source: "meta" });
  });

  it("upgrades a stored direct to a real signal before any answer", () => {
    captureAttribution("");
    expect(captureAttribution("page_variant=v3").page_variant).toBe("v3");
  });

  it("freezes attribution from the first answer: a pasted link cannot rewrite it", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    writeFunnel({ answers: { age: "25-34" } });
    expect(captureAttribution("page_variant=v5&utm_source=meta")).toMatchObject({
      page_variant: "v2",
      utm_source: "google",
    });
  });

  it("does not upgrade a stored direct once answers exist either", () => {
    captureAttribution("");
    writeFunnel({ answers: { age: "25-34" } });
    expect(captureAttribution("page_variant=v5").page_variant).toBe("direct");
  });

  it("is idempotent for the same URL", () => {
    const a = captureAttribution(ALL);
    expect(captureAttribution(ALL)).toStrictEqual(a);
  });

  it("is not mixed into a repeat view of the same URL after answers (refresh on the landing URL)", () => {
    loadAt(`/quiz?${ALL}`);
    getAttribution();
    writeFunnel({ answers: { age: "25-34" } });
    loadAt(`/quiz?${ALL}`);
    expect(getAttribution().page_variant).toBe("v3");
  });
});

describe("what is kept, and so what is sent", () => {
  it("holds all nine fields", () => {
    expect(captureAttribution(ALL)).toStrictEqual({
      page_variant: "v3",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "campaign_name",
      utm_content: "ad_name",
      utm_term: "keyword",
      gclid: "example",
      fbclid: "fb1",
      msclkid: "ms1",
    });
  });

  it("keeps the stored object identical to what getAttribution returns", () => {
    captureAttribution(ALL);
    expect(JSON.parse(window.sessionStorage.getItem("imageshield.attribution.v1")!)).toStrictEqual(getAttribution());
  });

  it("omits an absent field rather than holding null, which GTM would read as a value", () => {
    captureAttribution("page_variant=v2");
    expect(getAttribution()).toStrictEqual({ page_variant: "v2" });
  });

  it("sends direct when there was no attribution", () => {
    expect(getAttribution().page_variant).toBe("direct");
  });

  it("can say nothing with an invalid-only link, so it cannot displace what is stored", () => {
    captureAttribution("page_variant=v2");
    expect(captureAttribution("utm_source=a%40b.co").page_variant).toBe("v2");
  });
});

describe("freezing", () => {
  it("is not frozen before the quiz starts", () => {
    captureAttribution("page_variant=v2");
    expect(captureAttribution("page_variant=v4").page_variant).toBe("v4");
  });

  it("freezes attribution: nothing replaces it afterwards, whatever the URL says", () => {
    captureAttribution("page_variant=v2&utm_source=google");
    freezeAttribution();
    for (const search of ["page_variant=v5&utm_source=meta", "page_variant=v4", "utm_campaign=x", "gclid=g", ""]) {
      expect(captureAttribution(search)).toMatchObject({ page_variant: "v2", utm_source: "google" });
      expect(captureAttribution(search)).not.toHaveProperty("gclid");
    }
  });

  it("captures the current URL before freezing, so a deep link is frozen on its own attribution", () => {
    loadAt("/quiz/questions?q=3&page_variant=v5&utm_source=meta");
    freezeAttribution();
    expect(captureAttribution("page_variant=v2")).toMatchObject({ page_variant: "v5", utm_source: "meta" });
  });

  it("freezes direct too: a visit with no attribution stays direct", () => {
    loadAt("/quiz/questions?q=1");
    freezeAttribution();
    expect(captureAttribution("page_variant=v3").page_variant).toBe("direct");
  });

  it("survives a refresh", () => {
    loadAt(`/quiz?${ALL}`);
    freezeAttribution();
    loadAt("/quiz/questions?q=1&page_variant=v5");
    expect(getAttribution().page_variant).toBe("v3");
  });

  it("does not depend on the answers: clearing them does not reopen the window", () => {
    captureAttribution("page_variant=v2");
    freezeAttribution();
    writeFunnel({ answers: { age: "25-34" } });
    writeFunnel({ answers: {} });
    expect(captureAttribution("page_variant=v5").page_variant).toBe("v2");
  });

  it("is per tab: a new tab starts unfrozen", () => {
    captureAttribution("page_variant=v2");
    freezeAttribution();
    window.sessionStorage.clear();
    resetAttributionLoad();
    expect(captureAttribution("page_variant=v5").page_variant).toBe("v5");
  });

  it("still holds when sessionStorage is unavailable, for the life of the page", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      captureAttribution("page_variant=v2");
      freezeAttribution();
      expect(captureAttribution("page_variant=v5").page_variant).toBe("v2");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("is idempotent", () => {
    captureAttribution("page_variant=v2");
    freezeAttribution();
    freezeAttribution();
    expect(captureAttribution("page_variant=v5").page_variant).toBe("v2");
  });
});
