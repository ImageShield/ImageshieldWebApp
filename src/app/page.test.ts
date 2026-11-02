import { beforeEach, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) as never }));

import LandingPage from "./page";

const visit = (query: Record<string, string | string[] | undefined>) =>
  LandingPage({ searchParams: Promise.resolve(query) });

beforeEach(() => redirect.mockReset());

it("sends / to /quiz with nothing appended when there is no query", async () => {
  await visit({});
  expect(redirect).toHaveBeenCalledWith("/quiz");
});

it("carries every attribution parameter through to /quiz", async () => {
  await visit({
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
  const to = redirect.mock.calls[0][0] as string;
  expect(to.startsWith("/quiz?")).toBe(true);
  const params = new URLSearchParams(to.slice("/quiz?".length));
  expect(Object.fromEntries(params)).toStrictEqual({
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

it("re-encodes values so they survive the hop", async () => {
  await visit({ utm_campaign: "spring sale&2026", utm_term: "a+b=c" });
  const params = new URLSearchParams((redirect.mock.calls[0][0] as string).split("?")[1]);
  expect(params.get("utm_campaign")).toBe("spring sale&2026");
  expect(params.get("utm_term")).toBe("a+b=c");
});

it("keeps unrelated parameters and repeated ones, since the whole query goes with the visitor", async () => {
  await visit({ foo: "bar", tag: ["a", "b"], gone: undefined });
  expect(redirect).toHaveBeenCalledWith("/quiz?foo=bar&tag=a&tag=b");
});
