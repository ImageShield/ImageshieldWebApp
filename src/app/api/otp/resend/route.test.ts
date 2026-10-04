// @vitest-environment node
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestOtp } from "@/lib/v1/auth";
import { POST } from "./route";

/* The real `session.ts` runs here, against a fake cookie jar — the point is what the
   route does with a cookie an older release signed, so the cookie code can't be mocked
   away. */
const COOKIE = "imageshield.funnel";
const SECRET = "test-secret";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("@/lib/env", () => ({ funnelSecret: () => SECRET }));
vi.mock("@/lib/rate-limit", () => ({ allowOtpSend: () => ({ ok: true }) }));
vi.mock("@/lib/v1/auth", () => ({
  requestOtp: vi.fn(),
  resendCooldownSeconds: () => 30,
}));

function forge(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
}

function stored(): Record<string, unknown> {
  const [payload] = jar.get(COOKIE)!.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

const details = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+447700900123",
};
const inTenMinutes = () => Math.floor(Date.now() / 1000) + 600;
const resend = () =>
  POST(new Request("http://localhost/api/otp/resend", { method: "POST" }));

beforeEach(() => {
  jar.clear();
  vi.mocked(requestOtp)
    .mockReset()
    .mockResolvedValue({ challenge_id: "ch_new" } as Awaited<
      ReturnType<typeof requestOtp>
    >);
});

describe("POST /api/otp/resend", () => {
  it("drops an old cookie's typed birth date instead of carrying it forward", async () => {
    jar.set(
      COOKIE,
      forge({ ...details, dob: "1998-01-01", challengeId: "ch_old", exp: inTenMinutes() }),
    );

    const res = await resend();

    expect(res.status).toBe(401);
    expect(requestOtp).not.toHaveBeenCalled();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("re-signs only the known fields into the reissued cookie", async () => {
    jar.set(
      COOKIE,
      forge({
        ...details,
        ageConfirmed: true,
        dob: "1998-01-01",
        challengeId: "ch_old",
        exp: inTenMinutes(),
      }),
    );

    const res = await resend();

    expect(res.status).toBe(200);
    expect(requestOtp).toHaveBeenCalledWith("+447700900123");
    expect(stored()).toStrictEqual({
      ...details,
      ageConfirmed: true,
      challengeId: "ch_new",
      exp: expect.any(Number),
    });
  });
});
