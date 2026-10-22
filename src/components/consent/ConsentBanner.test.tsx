import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConsentBanner } from "./ConsentBanner";

/* As shipped: the switch off, and the wording visitors agreed to under v1 unchanged. */
vi.mock("@/lib/analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: false }));

afterEach(cleanup);

const NONE = { analytics: false, marketing: false };

it("keeps today's analytics wording, which names no answers", () => {
  const { container } = render(<ConsentBanner initial={NONE} manage onSave={vi.fn()} />);
  expect(
    screen.getByText(
      "Google Tag Manager, and any measurement tools we run through it, such as Google Analytics where enabled: which screens people reach and where they stop.",
    ),
  ).toBeTruthy();
  expect(container.textContent).not.toMatch(/options chosen|some of your answers/);
});

it("keeps today's summary", () => {
  const { container } = render(<ConsentBanner initial={NONE} manage={false} onSave={vi.fn()} />);
  expect(container.textContent).toContain(
    "With your OK, we use Google Tag Manager to see how the quiz is used, and HubSpot for marketing",
  );
  expect(container.textContent).not.toMatch(/some of your answers/);
});
