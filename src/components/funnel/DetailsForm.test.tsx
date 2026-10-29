import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFunnel } from "@/lib/funnel-state";
import { DetailsForm } from "./DetailsForm";

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
vi.mock("@/lib/use-quiz-definition", () => ({
  useQuizDefinition: () => ({ quiz: null }),
}));

const mockStartOtp = vi.fn();
vi.mock("@/lib/browser-auth", () => ({
  startOtp: (...args: unknown[]) => mockStartOtp(...args),
}));

const CONFIRM = "I confirm that I am 18 years old or older";

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  writeFunnel({ answers: { age: "18-24" }, phone: undefined, resendAfter: undefined });
  mockStartOtp.mockReset().mockResolvedValue({
    ok: true,
    phone: "+15551230000",
    challengeId: "ch_123",
    resendAfter: 30,
  });
});

afterEach(() => {
  cleanup();
});

function fillDetails() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "555 123 0000" },
  });
}

const submitButton = () => screen.getByRole("button", { name: "Get my score" });

describe("DetailsForm", () => {
  it("shows the 18+ checkbox, unticked", () => {
    render(<DetailsForm />);
    const box = screen.getByRole("checkbox", { name: CONFIRM });
    expect((box as HTMLInputElement).checked).toBe(false);
    expect((box as HTMLInputElement).required).toBe(true);
  });

  it("no longer asks for a date of birth", () => {
    const { container } = render(<DetailsForm />);
    expect(screen.queryByLabelText(/date of birth/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/date of birth/i)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      container.querySelector(
        'input[name="dob"], input[type="date"], input[autocomplete^="bday"]',
      ),
    ).toBeNull();
  });

  it("keeps the button disabled until the box is ticked", () => {
    render(<DetailsForm />);
    fillDetails();
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends nothing if the form is submitted without the tick", () => {
    const { container } = render(<DetailsForm />);
    fillDetails();
    fireEvent.submit(container.querySelector("form")!);
    expect(mockStartOtp).not.toHaveBeenCalled();
  });

  it("sends the confirmation, and no birth date, once ticked", async () => {
    render(<DetailsForm />);
    fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/otp"));
    expect(mockStartOtp).toHaveBeenCalledTimes(1);
    const contact = mockStartOtp.mock.calls[0][0];
    expect(contact).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      ageConfirmed: true,
      phone: "+15551230000",
    });
  });

  it("keeps no birth date in this tab's storage", async () => {
    render(<DetailsForm />);
    fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    fireEvent.click(submitButton());
    await waitFor(() => expect(push).toHaveBeenCalled());

    const kept = JSON.parse(window.sessionStorage.getItem("imageshield.funnel.v1")!);
    expect(JSON.stringify(kept)).not.toMatch(/dob|birth|2005/i);
  });

  describe("an under-18 answer", () => {
    beforeEach(() => writeFunnel({ answers: { age: "13-17" } }));

    it("is sent to the not-eligible page", () => {
      render(<DetailsForm />);
      expect(leave).toHaveBeenCalledWith("replace");
      expect(replace).not.toHaveBeenCalled();
    });

    it("is sent there on the live quiz's spelling too", () => {
      writeFunnel({ answers: { age: "Under 18" } });
      render(<DetailsForm />);
      expect(leave).toHaveBeenCalledWith("replace");
      expect(replace).not.toHaveBeenCalled();
    });

    it("cannot send a code, even with the box ticked", () => {
      render(<DetailsForm />);
      fillDetails();
      fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
      fireEvent.click(submitButton());
      expect(mockStartOtp).not.toHaveBeenCalled();
    });
  });

  it("lets an adult answer through", () => {
    render(<DetailsForm />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("still shows an error from client-side validation", async () => {
    render(<DetailsForm />);
    // Fill only first name and email, leave phone empty
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    fireEvent.click(submitButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter your number with its country code",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
