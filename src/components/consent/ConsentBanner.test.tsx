import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsentBanner, MARKETING_DETAIL, META_PIXEL_DETAIL } from "./ConsentBanner";

/* As shipped: the switch off, and the v1 analytics wording unchanged. */
vi.mock("@/lib/analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: false }));

afterEach(cleanup);

const NONE = { analytics: false, marketing: false };

it("keeps the analytics wording free of answers, and names the Meta Pixel in it", () => {
  const { container } = render(<ConsentBanner initial={NONE} manage onSave={vi.fn()} />);
  expect(
    screen.getByText(
      "Google Tag Manager, and Google Analytics through it: which screens people reach and where they stop. The Meta Pixel, also run through Tag Manager, tells Meta the pages you visit, the quiz steps you reach and the buttons you press, so we can measure our ads on Facebook and Instagram.",
    ),
  ).toBeTruthy();
  expect(container.textContent).not.toMatch(/options chosen|some of your answers/);
});

/* Where GTM actually runs the Pixel: the container loads with the analytics choice and
   the Pixel's tags have no consent check of their own. So Meta is described under
   Analytics, and the Marketing choice names only what it loads. */
it("describes Meta under Analytics, the choice that loads it, and not under Marketing", () => {
  render(<ConsentBanner initial={NONE} manage onSave={vi.fn()} />);
  const analytics = screen.getByRole("checkbox", { name: /^Analytics/ }).closest("label")!;
  const marketing = screen.getByRole("checkbox", { name: /^Marketing/ }).closest("label")!;
  expect(analytics.textContent).toContain(META_PIXEL_DETAIL);
  expect(marketing.textContent).not.toMatch(/Meta|Facebook|Instagram/);
  expect(marketing.textContent).toContain(MARKETING_DETAIL);
  expect(MARKETING_DETAIL).toMatch(/^HubSpot and Google's advertising signals\./);
});

it("summarises the choice in three short paragraphs, ending on the privacy policy", () => {
  render(<ConsentBanner initial={NONE} manage={false} onSave={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Your privacy matters" })).toBeTruthy();
  const region = screen.getByRole("region", { name: "Your privacy matters" });
  const paragraphs = [...region.querySelectorAll("p")].map((p) => p.textContent);
  expect(paragraphs).toStrictEqual([
    "With your permission, Google Analytics helps us understand how the quiz is used. The Meta Pixel measures which quiz steps visitors reach to help us understand advertising performance.",
    "HubSpot and Google's advertising signals help us measure our marketing. HubSpot may also use information you provide through our forms.",
    "The quiz works the same whatever you choose. You can change your preferences anytime through Cookie settings at the bottom of any page. Privacy policy",
  ]);
  expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe(
    "https://imageshield.com/privacy-policy",
  );
  for (const name of ["Reject all", "Accept all", "Choose what to allow"]) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
  }
});

/* Every vendor is named - Google's advertising signals included - and form
   information is HubSpot's alone: the Meta Pixel runs without advanced matching and
   reads no form. */
it("names Google's advertising signals, and attributes form information to HubSpot alone", () => {
  const { container } = render(<ConsentBanner initial={NONE} manage={false} onSave={vi.fn()} />);
  expect(container.textContent).toContain("HubSpot and Google's advertising signals help us measure our marketing.");
  expect(container.textContent).toContain("The Meta Pixel measures which quiz steps visitors reach");
  expect(container.textContent).toContain("HubSpot may also use information you provide through our forms.");
  expect(container.textContent).not.toMatch(/Meta[^.]*forms/);
  expect(container.textContent).not.toMatch(/some of your answers/);
});
