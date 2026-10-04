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

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));
/* A null definition skips the "finished the quiz?" guard, which is not what these
   tests are about. */
vi.mock("@/lib/use-quiz-definition", () => ({
  useQuizDefinition: () => ({ quiz: null }),
}));

const CONFIRM = "I confirm that I am 18 years old or older";

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  // An adult who finished the quiz, unless a test says otherwise.
  writeFunnel({ answers: { age: "18-24" }, phone: undefined, resendAfter: undefined });
  fetchMock.mockReset().mockResolvedValue(
    new Response(JSON.stringify({ ok: true, phone: "+15551230000", resendAfter: 30 }), {
      status: 200,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the confirmation, and no birth date, once ticked", async () => {
    render(<DetailsForm />);
    fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/otp"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/otp/start");
    expect(JSON.parse(init.body)).toStrictEqual({
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
    expect(Object.keys(kept).sort()).toStrictEqual(
      ["answers", "lastStep", "phone", "resendAfter"].sort(),
    );
    expect(JSON.stringify(kept)).not.toMatch(/dob|birth|2005/i);
  });

  describe("an under-18 answer", () => {
    beforeEach(() => writeFunnel({ answers: { age: "13-17" } }));

    it("is sent to the not-eligible page", () => {
      render(<DetailsForm />);
      expect(replace).toHaveBeenCalledWith("/not-eligible");
    });

    it("is sent there on the live quiz's spelling too", () => {
      writeFunnel({ answers: { age: "Under 18" } });
      render(<DetailsForm />);
      expect(replace).toHaveBeenCalledWith("/not-eligible");
    });

    it("cannot send a code, even with the box ticked", () => {
      render(<DetailsForm />);
      fillDetails();
      fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
      fireEvent.click(submitButton());
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("lets an adult answer through", () => {
    render(<DetailsForm />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("still shows the server's error in the alert", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Enter a valid email address" }), {
        status: 400,
      }),
    );
    render(<DetailsForm />);
    fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: CONFIRM }));
    fireEvent.click(submitButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enter a valid email address",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
