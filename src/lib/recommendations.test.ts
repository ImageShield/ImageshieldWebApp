// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkText, recommendationsFrom, type GeneralRecommendation } from "./recommendations";

const LINKED: GeneralRecommendation = {
  title: "Fixture: an instruction",
  body: "Fixture: one sentence.",
  link: { url: "https://example.org/guide", label: "Read the guide" },
};
const UNLINKED: GeneralRecommendation = {
  title: "Fixture: another instruction",
  body: "Fixture: another sentence.",
  link: null,
};

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("recommendationsFrom", () => {
  it("keeps the served list as served - same order, same strings", () => {
    expect(recommendationsFrom([LINKED, UNLINKED])).toStrictEqual([LINKED, UNLINKED]);
    expect(recommendationsFrom([UNLINKED, LINKED])).toStrictEqual([UNLINKED, LINKED]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads anything but a list as none, and says so", () => {
    for (const raw of [undefined, null, {}]) expect(recommendationsFrom(raw)).toStrictEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("drops an entry with no title or body and keeps the rest in order", () => {
    const served = [LINKED, { ...LINKED, title: "" }, { ...LINKED, body: null }, UNLINKED];

    expect(recommendationsFrom(served)).toStrictEqual([LINKED, UNLINKED]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("keeps a null label as null", () => {
    const [kept] = recommendationsFrom([
      { ...LINKED, link: { url: "https://example.org/guide", label: null } },
    ]);
    expect(kept.link).toStrictEqual({ url: "https://example.org/guide", label: null });
  });

  it("treats a blank label as no label", () => {
    const [kept] = recommendationsFrom([
      { ...LINKED, link: { url: "https://example.org/guide", label: "   " } },
    ]);
    expect(kept.link?.label).toBeNull();
  });

  /* The words stay; only a link that can't be followed safely goes. */
  it.each([
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<p>hi</p>"],
    ["a relative path", "/research/privacy"],
    ["not a URL", "see the research"],
    ["an empty string", ""],
    ["a non-web scheme", "ftp://example.org/file"],
  ])("drops the link but keeps the recommendation for %s", (_, url) => {
    const [kept] = recommendationsFrom([{ ...LINKED, link: { url, label: "Read" } }]);
    expect(kept).toStrictEqual({ title: LINKED.title, body: LINKED.body, link: null });
  });

  it("drops a link with no url at all", () => {
    const [kept] = recommendationsFrom([{ ...LINKED, link: { label: "Read" } }]);
    expect(kept.link).toBeNull();
  });
});

describe("linkText", () => {
  it("is the research's own label when it gave one", () => {
    expect(linkText({ url: "https://example.org/guide", label: "Read the guide" })).toBe(
      "Read the guide",
    );
  });

  it("falls back to the page's host, without the www", () => {
    expect(linkText({ url: "https://www.example.com/research/privacy", label: null })).toBe(
      "example.com",
    );
    expect(linkText({ url: "https://support.example.org/a?b=c", label: null })).toBe(
      "support.example.org",
    );
  });
});
