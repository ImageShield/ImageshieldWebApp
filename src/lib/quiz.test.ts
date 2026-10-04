import { describe, expect, it } from "vitest";
import { declaresMinor } from "./quiz";

describe("declaresMinor", () => {
  /* "Under 18" is what the live quiz serves (prod v11, dev v15); "13-17" is the
     local dev fixture's older band. */
  it.each(["Under 18", "13-17"])("is true for %s", (age) => {
    expect(declaresMinor({ age, gender: "Female" })).toBe(true);
  });

  it.each(["18-24", "25-34", "35-54", "35-44", "45-54", "55+"])("is false for %s", (age) => {
    expect(declaresMinor({ age })).toBe(false);
  });

  it("is false when the age question hasn't been answered", () => {
    expect(declaresMinor({})).toBe(false);
  });

  it("only reads the age question", () => {
    expect(declaresMinor({ gender: "Under 18" })).toBe(false);
  });
});
