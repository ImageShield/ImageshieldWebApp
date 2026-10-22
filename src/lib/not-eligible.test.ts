import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "./funnel-state";
import { leaveForNotEligible, reloadIfTrackingSurvived, trackingBlocked } from "./not-eligible";

const { reloadPage } = vi.hoisted(() => ({ reloadPage: vi.fn() }));
vi.mock("./consent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./consent")>()),
  reloadPage,
}));

const fakeLocation = () => ({ assign: vi.fn(), replace: vi.fn() });

beforeEach(() => {
  writeFunnel({ answers: {} });
  reloadPage.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("leaveForNotEligible", () => {
  it("loads /not-eligible as a new page, keeping push or replace", () => {
    const pushed = fakeLocation();
    leaveForNotEligible("push", pushed);
    expect(pushed.assign).toHaveBeenCalledWith("/not-eligible");
    expect(pushed.replace).not.toHaveBeenCalled();

    const replaced = fakeLocation();
    leaveForNotEligible("replace", replaced);
    expect(replaced.replace).toHaveBeenCalledWith("/not-eligible");
    expect(replaced.assign).not.toHaveBeenCalled();
  });

  /* Tags already running on this page are told consent is gone before it unloads. */
  it("denies every Google consent signal first, as a gtag command", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("dataLayer", dataLayer);
    const location = fakeLocation();
    location.assign.mockImplementation(() => expect(dataLayer).toHaveLength(1));
    leaveForNotEligible("push", location);
    const command = dataLayer[0];
    expect(Object.prototype.toString.call(command)).toBe("[object Arguments]");
    expect(Array.from(command as ArrayLike<unknown>)).toEqual([
      "consent",
      "update",
      { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" },
    ]);
    expect(location.assign).toHaveBeenCalledTimes(1);
  });

  it("creates no dataLayer when no container is running", () => {
    leaveForNotEligible("replace", fakeLocation());
    expect((window as Window & { dataLayer?: unknown }).dataLayer).toBeUndefined();
  });
});

describe("trackingBlocked", () => {
  it("blocks the /not-eligible page whoever is looking", () => {
    writeFunnel({ answers: { age: "25-34" } });
    expect(trackingBlocked("/not-eligible")).toBe(true);
  });

  it.each(["Under 18", "13-17"])("blocks every page once the answers say %s", (age) => {
    writeFunnel({ answers: { age } });
    for (const path of ["/quiz", "/quiz/questions", "/details", "/", null]) {
      expect(trackingBlocked(path)).toBe(true);
    }
  });

  it("leaves adults, and visitors who haven't answered yet, alone", () => {
    expect(trackingBlocked("/quiz")).toBe(false);
    writeFunnel({ answers: { age: "25-34" } });
    expect(trackingBlocked("/quiz/questions")).toBe(false);
    expect(trackingBlocked(null)).toBe(false);
  });
});

describe("reloadIfTrackingSurvived", () => {
  it.each([
    ["GTM", "dataLayer", []],
    ["GTM's runtime", "google_tag_manager", {}],
    ["HubSpot", "_hsq", []],
  ])("reloads a restored page still running %s once the answers say under 18", (_, name, value) => {
    vi.stubGlobal(name, value);
    writeFunnel({ answers: { age: "Under 18" } });
    reloadIfTrackingSurvived();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("leaves an adult's restored page alone", () => {
    vi.stubGlobal("dataLayer", []);
    writeFunnel({ answers: { age: "25-34" } });
    reloadIfTrackingSurvived();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("doesn't reload a page that never loaded anything", () => {
    writeFunnel({ answers: { age: "Under 18" } });
    reloadIfTrackingSurvived();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
