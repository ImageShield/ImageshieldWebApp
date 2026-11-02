import { expect, it } from "vitest";
import robots from "./robots";

const rules = () => {
  const r = robots().rules;
  return (Array.isArray(r) ? r[0] : r) as { userAgent: string; allow: string[]; disallow: string[] };
};

it("keeps the public front door open", () => {
  expect(rules().userAgent).toBe("*");
  expect(rules().allow).toStrictEqual(["/", "/quiz"]);
});

it("keeps crawlers out of the private funnel routes and the API", () => {
  expect(rules().disallow).toStrictEqual([
    "/details",
    "/otp",
    "/calculating",
    "/score",
    "/not-eligible",
    "/api/",
  ]);
});

it("does not block the whole site", () => {
  expect(rules().disallow).not.toContain("/");
});

it("does not block public assets or the quiz intro", () => {
  for (const open of ["/quiz", "/media/", "/favicon.ico", "/_next/"]) {
    expect(rules().disallow.some((d) => open.startsWith(d))).toBe(false);
  }
});
