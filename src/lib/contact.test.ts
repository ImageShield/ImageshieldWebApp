import { describe, expect, it } from "vitest";
import { validateContact } from "./contact";

const body = {
  firstName: " Ada ",
  lastName: "Lovelace",
  email: "Ada@Example.com",
  phone: "+44 7700 900123",
  ageConfirmed: true,
};

describe("validateContact", () => {
  it("accepts a contact that confirms 18+", () => {
    expect(validateContact(body)).toStrictEqual({
      ok: true,
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "+447700900123",
        ageConfirmed: true,
      },
    });
  });

  it.each([
    ["missing", undefined],
    ["false", false],
    ['the string "true"', "true"],
    ["1", 1],
    ["null", null],
  ])("refuses an 18+ confirmation that is %s", (_, ageConfirmed) => {
    expect(validateContact({ ...body, ageConfirmed })).toStrictEqual({
      ok: false,
      error: "Confirm that you are 18 or older to continue",
    });
  });

  it("refuses a body that sends a date of birth instead of the confirmation", () => {
    const dobInstead = { ...body, ageConfirmed: undefined, dob: "1990-05-17" };
    expect(validateContact(dobInstead)).toStrictEqual({
      ok: false,
      error: "Confirm that you are 18 or older to continue",
    });
  });

  it("drops a date of birth sent alongside the confirmation", () => {
    const result = validateContact({ ...body, dob: "1990-05-17" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.contact).not.toHaveProperty("dob");
    expect(JSON.stringify(result)).not.toContain("1990-05-17");
  });

  it("still reports the phone before the confirmation", () => {
    expect(
      validateContact({ ...body, phone: "5551230000", ageConfirmed: false }),
    ).toStrictEqual({ ok: false, error: "Enter your number with its country code" });
  });
});
