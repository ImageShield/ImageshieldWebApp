import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConsent, serializeConsent } from "@/lib/consent";
import { ANALYTICS_DETAIL_WITH_ANSWERS, ConsentBanner, META_PIXEL_DETAIL } from "./ConsentBanner";

/* What legal approving the answer-level wording turns on. With the switch off - as
   shipped - ConsentManager.test.tsx and consent.test.ts pin today's v1 behaviour. */
vi.mock("@/lib/analytics-approval", () => ({ ANSWER_ANALYTICS_APPROVED: true }));

afterEach(cleanup);

const NONE = { analytics: false, marketing: false };

describe("consent once answer analytics is approved", () => {
  it("records choices as v4", () => {
    expect(serializeConsent({ analytics: true, marketing: false })).toBe("v4.a1.m0");
    expect(parseConsent("v4.a1.m0")).toStrictEqual({ analytics: true, marketing: false });
  });

  /* A yes to the old wording is not a yes to sending answers, nor v2's to Meta. */
  it("asks everyone who chose under v1, v2 or v3 again", () => {
    for (const v of ["v1", "v2", "v3"]) {
      expect(parseConsent(`${v}.a1.m1`)).toBeNull();
      expect(parseConsent(`${v}.a0.m0`)).toBeNull();
    }
  });

  it("names answer-level collection, and what is never sent, in the analytics choice", () => {
    render(<ConsentBanner initial={NONE} manage onSave={vi.fn()} />);
    expect(screen.getByText(ANALYTICS_DETAIL_WITH_ANSWERS)).toBeTruthy();
    expect(ANALYTICS_DETAIL_WITH_ANSWERS).toMatch(/options chosen for some questions/);
    expect(ANALYTICS_DETAIL_WITH_ANSWERS).toMatch(/Never your age, gender, experience of misuse/);
    /* The Pixel loads with this choice whatever the answer wording says. */
    expect(ANALYTICS_DETAIL_WITH_ANSWERS.endsWith(META_PIXEL_DETAIL)).toBe(true);
  });

  it("says so in the summary too", () => {
    render(<ConsentBanner initial={NONE} manage={false} onSave={vi.fn()} />);
    expect(screen.getByText(/including some of your answers/)).toBeTruthy();
  });
});
