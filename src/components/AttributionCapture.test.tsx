import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import { resetAttributionLoad } from "@/lib/attribution";
import { AttributionCapture } from "./AttributionCapture";

const stored = () => JSON.parse(window.sessionStorage.getItem("imageshield.attribution.v1") ?? "null");

beforeEach(() => {
  writeFunnel({ answers: {} });
  window.sessionStorage.clear();
  resetAttributionLoad();
});
afterEach(cleanup);

it("captures the address bar's attribution on mount", () => {
  window.history.replaceState(null, "", "/quiz?page_variant=v4&utm_source=google&gclid=abc");
  render(<AttributionCapture />);
  expect(stored()).toMatchObject({ page_variant: "v4", utm_source: "google", gclid: "abc" });
});

it("stores direct for a visit with no parameters", () => {
  window.history.replaceState(null, "", "/quiz");
  render(<AttributionCapture />);
  expect(stored()).toMatchObject({ page_variant: "direct" });
});

it("is harmless to mount twice, as React does in development", () => {
  window.history.replaceState(null, "", "/?page_variant=v2");
  const first = render(<AttributionCapture />);
  first.unmount();
  render(<AttributionCapture />);
  expect(stored().page_variant).toBe("v2");
});
