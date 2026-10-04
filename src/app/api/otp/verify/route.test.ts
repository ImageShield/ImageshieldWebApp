// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveLead } from "@/lib/quiz-save";
import { readChallenge, type Challenge } from "@/lib/session";
import { fetchMe, type Me } from "@/lib/v1/me";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({
  readChallenge: vi.fn(),
  adoptTokens: vi.fn(),
  clearChallenge: vi.fn(),
}));
vi.mock("@/lib/quiz-save", () => ({ saveLead: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ allow: () => true }));
vi.mock("@/lib/v1/auth", () => ({ verifyOtp: vi.fn() }));
vi.mock("@/lib/v1/me", () => ({ fetchMe: vi.fn() }));

const challenge: Challenge = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+447700900123",
  ageConfirmed: true,
  challengeId: "ch_1",
  exp: Math.floor(Date.now() / 1000) + 600,
};

const me = { onboarding: {}, person: {} } as Me;

const verify = () =>
  POST(
    new Request("http://localhost/api/otp/verify", {
      method: "POST",
      body: JSON.stringify({ code: "123456" }),
    }),
  );

beforeEach(() => {
  vi.mocked(saveLead).mockReset().mockResolvedValue(true);
  vi.mocked(fetchMe).mockReset().mockResolvedValue(me);
});

describe("POST /api/otp/verify", () => {
  it("hands the confirmed contact to saveLead, with no birth date", async () => {
    vi.mocked(readChallenge).mockResolvedValue(challenge);

    const res = await verify();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, leadSaved: true });
    expect(saveLead).toHaveBeenCalledWith(
      {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        ageConfirmed: true,
      },
      me,
    );
  });

  it("writes nothing without a valid challenge — no code, no cookie, no save", async () => {
    vi.mocked(readChallenge).mockResolvedValue(null);

    const res = await verify();

    expect(res.status).toBe(401);
    expect(saveLead).not.toHaveBeenCalled();
  });

  it("tells saveLead the record is unknown when /v1/me can't be read", async () => {
    vi.mocked(readChallenge).mockResolvedValue(challenge);
    vi.mocked(fetchMe).mockRejectedValue(new Error("502"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await verify();

    expect(vi.mocked(saveLead).mock.calls[0][1]).toBeNull();
  });

  /* `readChallenge` already refuses these (see session.test.ts); this pins the second
     check in the route itself. */
  it("does not treat a cookie from before the checkbox as confirmed", async () => {
    vi.mocked(readChallenge).mockResolvedValue({
      ...challenge,
      ageConfirmed: undefined,
      dob: "2011-03-04",
    } as unknown as Challenge);

    await verify();

    const [sent] = vi.mocked(saveLead).mock.calls[0];
    expect(sent.ageConfirmed).toBe(false);
    expect(sent).not.toHaveProperty("dob");
  });
});
