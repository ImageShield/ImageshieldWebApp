// @vitest-environment node
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "./contact";
import { readChallenge, startChallenge } from "./session";

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
vi.mock("./env", () => ({ funnelSecret: () => SECRET }));

/** Signs a payload the way `session.ts` does, to plant cookies an older release wrote. */
function forge(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
}

function stored(): Record<string, unknown> {
  const [payload] = jar.get(COOKIE)!.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString());
}

const contact: Contact = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+447700900123",
  ageConfirmed: true,
};
const inTenMinutes = () => Math.floor(Date.now() / 1000) + 600;

beforeEach(() => jar.clear());

describe("readChallenge", () => {
  it("refuses, and deletes, a cookie from before the 18+ checkbox", async () => {
    const beforeCheckbox = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+447700900123",
      dob: "1998-01-01",
    };
    jar.set(COOKIE, forge({ ...beforeCheckbox, challengeId: "ch_1", exp: inTenMinutes() }));

    expect(await readChallenge()).toBeNull();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("reads a confirmed challenge", async () => {
    jar.set(COOKIE, forge({ ...contact, challengeId: "ch_1", exp: inTenMinutes() }));
    expect(await readChallenge()).toMatchObject({ ...contact, challengeId: "ch_1" });
  });
});

describe("startChallenge", () => {
  it("never signs a birth date into the cookie, whatever it is handed", async () => {
    const withDob = { ...contact, dob: "1998-01-01" } as Contact;
    await startChallenge(withDob, "ch_2");

    expect(stored()).toStrictEqual({
      ...contact,
      challengeId: "ch_2",
      exp: expect.any(Number),
    });
    expect(jar.get(COOKIE)).not.toContain(Buffer.from("1998").toString("base64url"));
  });
});
