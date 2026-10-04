// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startChallenge } from "@/lib/session";
import { requestOtp } from "@/lib/v1/auth";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({ startChallenge: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ allowOtpSend: () => ({ ok: true }) }));
vi.mock("@/lib/v1/auth", () => ({
  requestOtp: vi.fn(),
  resendCooldownSeconds: () => 30,
}));

const body = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+447700900123",
  ageConfirmed: true,
};

const post = (json: unknown) =>
  POST(
    new Request("http://localhost/api/otp/start", {
      method: "POST",
      body: JSON.stringify(json),
    }),
  );

beforeEach(() => {
  vi.mocked(startChallenge).mockReset();
  vi.mocked(requestOtp)
    .mockReset()
    .mockResolvedValue({ challenge_id: "ch_1" } as Awaited<
      ReturnType<typeof requestOtp>
    >);
});

describe("POST /api/otp/start", () => {
  /* Direct requests, with no form in front: the server is the gate, not the button. */
  it.each([
    ["false", false],
    ['the string "true"', "true"],
    ["1", 1],
    ["null", null],
    ["an object", { confirmed: true }],
    ["a list", [true]],
  ])("refuses an 18+ confirmation that is %s", async (_, ageConfirmed) => {
    const res = await post({ ...body, ageConfirmed });

    expect(res.status).toBe(400);
    expect(requestOtp).not.toHaveBeenCalled();
    expect(startChallenge).not.toHaveBeenCalled();
  });

  it("sends no code without the 18+ confirmation", async () => {
    // JSON drops the undefined key, so this posts a body with a dob and no flag.
    const res = await post({ ...body, ageConfirmed: undefined, dob: "1990-05-17" });

    expect(res.status).toBe(400);
    expect(await res.json()).toStrictEqual({
      error: "Confirm that you are 18 or older to continue",
    });
    expect(requestOtp).not.toHaveBeenCalled();
    expect(startChallenge).not.toHaveBeenCalled();
  });

  it("sends the code and keeps no birth date in the challenge cookie", async () => {
    const res = await post({ ...body, dob: "1990-05-17" });

    expect(res.status).toBe(200);
    expect(requestOtp).toHaveBeenCalledWith("+447700900123");
    expect(startChallenge).toHaveBeenCalledWith(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "+447700900123",
        ageConfirmed: true,
      },
      "ch_1",
    );
    expect(vi.mocked(startChallenge).mock.calls[0][0]).not.toHaveProperty("dob");
  });
});
