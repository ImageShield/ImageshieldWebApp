import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import { OtpForm } from "./OtpForm";

/* The full-page hop to /not-eligible, recorded rather than performed (jsdom can't navigate). */
const leave = vi.hoisted(() => vi.fn());
vi.mock("@/lib/not-eligible", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/not-eligible")>()),
  leaveForNotEligible: leave,
}));
beforeEach(() => {
  leave.mockReset();
  window.sessionStorage.removeItem("imageshield.under18");
});

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const mockVerifyOtp = vi.fn();
const mockResendOtp = vi.fn();
vi.mock("@/lib/browser-auth", () => ({
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  resendOtp: (...args: unknown[]) => mockResendOtp(...args),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  mockVerifyOtp.mockReset().mockResolvedValue({ ok: true, quizAlreadyTaken: false });
  mockResendOtp.mockReset().mockResolvedValue({ ok: true, challengeId: "ch_new", resendAfter: 30 });
});

afterEach(() => {
  cleanup();
});

/* A paste into the first box spreads across the row and verifies by itself. */
const enterCode = () =>
  fireEvent.change(screen.getByLabelText("Digit 1 of 6"), {
    target: { value: "123456" },
  });

describe("OtpForm", () => {
  /* Verifying is what writes the adult placeholder birth date, so an under-18 answer
     changed after the code went out must still stop here. */
  it("turns away an under-18 answer and never verifies", () => {
    writeFunnel({ phone: "+15551230000", answers: { age: "13-17" } });
    render(<OtpForm />);

    expect(leave).toHaveBeenCalledWith("replace");
    expect(replace).not.toHaveBeenCalled();
    enterCode();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  /* The age changed to under 18 after this screen loaded (another tab, or back and
     forward): the check at verify time catches it, before any code is sent. */
  it("turns away an answer that became under-18 after the screen loaded", () => {
    writeFunnel({ phone: "+15551230000", answers: { age: "18-24" }, challengeId: "ch_123" });
    render(<OtpForm />);
    expect(leave).not.toHaveBeenCalled();
    writeFunnel({ answers: { age: "Under 18" } });
    enterCode();
    expect(leave).toHaveBeenCalledWith("replace");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it("verifies as before for an adult answer", () => {
    writeFunnel({ phone: "+15551230000", answers: { age: "18-24" }, challengeId: "ch_123" });
    render(<OtpForm />);

    expect(replace).not.toHaveBeenCalled();
    enterCode();
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      "ch_123",
      "123456",
      expect.objectContaining({ ageConfirmed: true }),
    );
  });

  /* /calculating is where the answers in this tab are written. An account that
     already has a score is not sent there: its score is read, not recomputed. */
  describe("after a verified code", () => {
    it("takes an account that has taken the quiz straight to its score", async () => {
      writeFunnel({ phone: "+15551230000", answers: { age: "18-24" }, challengeId: "ch_123" });
      mockVerifyOtp.mockResolvedValue({ ok: true, quizAlreadyTaken: true });
      render(<OtpForm />);

      enterCode();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/score"));
      expect(push).not.toHaveBeenCalledWith("/calculating");
    });

    it("sends a new account on to be scored", async () => {
      writeFunnel({ phone: "+15551230000", answers: { age: "18-24" }, challengeId: "ch_123" });
      mockVerifyOtp.mockResolvedValue({ ok: true, quizAlreadyTaken: false });
      render(<OtpForm />);

      enterCode();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/calculating"));
    });
  });
});
