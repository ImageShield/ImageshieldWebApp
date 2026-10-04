// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveLead } from "./quiz-save";
import { patchProfile, setEmail } from "./v1/profile";
import type { Me } from "./v1/me";

/* The real `SYNTHETIC_ADULT_DOB` stays in; only the two network calls are replaced.
   The assertions spell the date out rather than importing the constant, so changing
   the agreed value fails here instead of passing silently. */
vi.mock("./v1/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./v1/profile")>()),
  patchProfile: vi.fn(),
  setEmail: vi.fn(),
}));
vi.mock("./session", () => ({ callAsUser: vi.fn() }));
vi.mock("./v1/quiz", () => ({ submitQuizResponses: vi.fn() }));

const contact = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  ageConfirmed: true,
};

function meWith(dateOfBirth: string | null, email: string | null = null): Me {
  return {
    account: { phone_e164: "+447700900123", status: "active" },
    person: {
      person_id: "p_1",
      first_name: null,
      last_name: null,
      email,
      email_verified: false,
      date_of_birth: dateOfBirth,
      employer_name: null,
      occupation: null,
      school_name: null,
    },
    onboarding: {} as Me["onboarding"],
    score: null,
  };
}

const sentProfile = () => vi.mocked(patchProfile).mock.calls[0][0];

beforeEach(() => {
  vi.mocked(patchProfile).mockReset().mockResolvedValue({} as Me["person"]);
  vi.mocked(setEmail).mockReset().mockResolvedValue(undefined);
});

describe("saveLead", () => {
  it("sends the agreed placeholder DOB when the record has none", async () => {
    await expect(saveLead(contact, meWith(null))).resolves.toBe(true);
    expect(sentProfile()).toStrictEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      date_of_birth: "2005-01-01",
    });
  });

  /* date_of_birth is write-once on /v1: a second value is refused and takes the
     whole PATCH — names included — down with it. */
  describe("never attempts a second birth date", () => {
    it("leaves a birth date already on the record alone", async () => {
      await saveLead(contact, meWith("1990-05-17"));
      expect(patchProfile).toHaveBeenCalledTimes(1);
      expect(sentProfile()).toStrictEqual({ first_name: "Ada", last_name: "Lovelace" });
    });

    it("sends none when /v1/me couldn't be read", async () => {
      await saveLead(contact, null);
      expect(sentProfile()).toStrictEqual({ first_name: "Ada", last_name: "Lovelace" });
    });

    it("sends none when /v1/me came back without a person", async () => {
      await saveLead(contact, { onboarding: {} } as unknown as Me);
      expect(sentProfile()).not.toHaveProperty("date_of_birth");
    });

    it("still saves the name and email when it leaves the date out", async () => {
      await expect(saveLead(contact, null)).resolves.toBe(true);
      expect(setEmail).toHaveBeenCalledWith("ada@example.com");
    });
  });

  it("writes no placeholder without the 18+ confirmation", async () => {
    await saveLead({ ...contact, ageConfirmed: false }, meWith(null));
    expect(sentProfile()).not.toHaveProperty("date_of_birth");
  });

  it("never forwards a birth date that rides along on the contact", async () => {
    const withDob = { ...contact, dob: "1990-05-17" };
    await saveLead(withDob, meWith(null));
    expect(sentProfile().date_of_birth).toBe("2005-01-01");
    expect(JSON.stringify(vi.mocked(patchProfile).mock.calls)).not.toContain("1990");
  });

  it("still only sets the email when it differs from the record", async () => {
    await saveLead(contact, meWith(null, "ADA@example.com"));
    expect(setEmail).not.toHaveBeenCalled();

    await saveLead(contact, meWith(null, "old@example.com"));
    expect(setEmail).toHaveBeenCalledWith("ada@example.com");
  });

  it("reports a failed write without throwing", async () => {
    vi.mocked(patchProfile).mockRejectedValue(new Error("400"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(saveLead(contact, null)).resolves.toBe(false);
  });
});
