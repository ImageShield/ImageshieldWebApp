import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import { OtpForm } from "./OtpForm";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  fetchMock
    .mockReset()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

    expect(replace).toHaveBeenCalledWith("/not-eligible");
    enterCode();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies as before for an adult answer", () => {
    writeFunnel({ phone: "+15551230000", answers: { age: "18-24" } });
    render(<OtpForm />);

    expect(replace).not.toHaveBeenCalled();
    enterCode();
    expect(fetchMock).toHaveBeenCalledWith("/api/otp/verify", expect.anything());
  });

  /* /calculating is where the answers in this tab are written. An account that
     already has a score is not sent there: its score is read, not recomputed. */
  describe("after a verified code", () => {
    const verifiedWith = (body: unknown) =>
      fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

    it("takes an account that has taken the quiz straight to its score", async () => {
      writeFunnel({ phone: "+15551230000", answers: { age: "18-24" } });
      verifiedWith({ ok: true, quizAlreadyTaken: true });
      render(<OtpForm />);

      enterCode();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/score"));
      expect(push).not.toHaveBeenCalledWith("/calculating");
    });

    it("sends a new account on to be scored", async () => {
      writeFunnel({ phone: "+15551230000", answers: { age: "18-24" } });
      verifiedWith({ ok: true, quizAlreadyTaken: false });
      render(<OtpForm />);

      enterCode();

      await waitFor(() => expect(push).toHaveBeenCalledWith("/calculating"));
    });
  });
});
