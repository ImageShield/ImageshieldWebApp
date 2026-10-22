import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTrackingCookies,
  googleConsent,
  parseConsent,
  readConsent,
  serializeConsent,
  CONSENT_VERSION,
  writeConsent,
} from "./consent";

function cookieNames(): string[] {
  return document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
}

afterEach(() => {
  for (const name of cookieNames()) document.cookie = `${name}=; Max-Age=0; Path=/`;
  vi.restoreAllMocks();
});

describe("consent cookie", () => {
  it("round-trips every choice", () => {
    for (const analytics of [true, false]) {
      for (const marketing of [true, false]) {
        expect(parseConsent(serializeConsent({ analytics, marketing }))).toEqual({
          analytics,
          marketing,
        });
      }
    }
  });

  /* An older VERSION is how the banner asks everyone again, so it must read as
     "no choice" rather than as whatever its flags happened to say. */
  it("treats a missing, malformed or older-version value as no choice", () => {
    for (const value of [undefined, "", "v1", "v1.a1", "v1.a2.m0", "v1.a1.m1.x", "v0.a1.m1"]) {
      expect(parseConsent(value)).toBeNull();
    }
  });

  it("writes a host-only, six-month, Lax cookie", () => {
    const set = vi.spyOn(Document.prototype, "cookie", "set");
    writeConsent({ analytics: true, marketing: false });
    // No `Secure` here: the test page is http://localhost.
    expect(set).toHaveBeenCalledWith(
      `imageshield_consent=${CONSENT_VERSION}.a1.m0; Max-Age=15724800; Path=/; SameSite=Lax`,
    );
  });

  it("keeps the same snapshot until its own cookie changes", () => {
    writeConsent({ analytics: true, marketing: false });
    const first = readConsent();
    document.cookie = "_ga=GA1.1.1; Path=/";
    expect(readConsent()).toBe(first);

    writeConsent({ analytics: true, marketing: true });
    expect(readConsent()).toEqual({ analytics: true, marketing: true });
  });

  it("maps marketing onto all three of Google's advertising signals", () => {
    expect(googleConsent({ analytics: true, marketing: false })).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("clears only the withdrawn category's cookies", () => {
    for (const name of ["_ga", "_ga_ABC123", "_gcl_au", "__hstc", "hubspotutk", "other"]) {
      document.cookie = `${name}=1; Path=/`;
    }
    writeConsent({ analytics: false, marketing: true });

    clearTrackingCookies({ analytics: true, marketing: false });
    expect(cookieNames().sort()).toEqual(
      ["__hstc", "_gcl_au", "hubspotutk", "imageshield_consent", "other"].sort(),
    );

    clearTrackingCookies({ analytics: false, marketing: true });
    expect(cookieNames().sort()).toEqual(["imageshield_consent", "other"]);
  });
});

/* On the real host, where the parent domain is someone else's: imageshield.com's own
   GA4 writes `_ga_*` to `.imageshield.com`, and a withdrawal on the quiz must leave it. */
describe("clearing tracking cookies on quiz.imageshield.com", () => {
  const dom = (globalThis as unknown as { jsdom: { reconfigure(o: { url: string }): void } })
    .jsdom;

  beforeEach(() => dom.reconfigure({ url: "https://quiz.imageshield.com/score" }));
  afterEach(() => {
    for (const name of cookieNames()) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=imageshield.com`;
    }
    dom.reconfigure({ url: "http://localhost:3000/" });
  });

  it("deletes the quiz's own cookies and leaves the parent domain's", () => {
    document.cookie = "_ga=quiz; Path=/";
    document.cookie = "__hstc=quiz; Path=/; Domain=quiz.imageshield.com";
    document.cookie = "_ga_S8ZFJXY5DT=main-site; Path=/; Domain=imageshield.com";
    document.cookie = "_gcl_au=main-site; Path=/; Domain=imageshield.com";

    clearTrackingCookies({ analytics: true, marketing: true });

    expect(cookieNames().sort()).toEqual(["_ga_S8ZFJXY5DT", "_gcl_au"]);
  });
});
