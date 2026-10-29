import { describe, expect, it } from "vitest";
import {
  CALLING_CODES,
  DEFAULT_CALLING_CODE,
  DEFAULT_COUNTRY,
} from "./calling-codes";

describe("CALLING_CODES", () => {
  const labels = CALLING_CODES.map((c) => c.label);

  it("covers every country, not a shortlist", () => {
    expect(CALLING_CODES.length).toBeGreaterThan(200);
    for (const name of ["India", "Pakistan", "China", "Egypt", "Vietnam", "Peru"]) {
      expect(labels).toContain(name);
    }
  });

  it("keys the picker on unique labels, in alphabetical order", () => {
    expect(new Set(labels).size).toBe(labels.length);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
  });

  it("keeps every code to the 1–3 digits the picker has room for", () => {
    for (const { code } of CALLING_CODES) expect(code).toMatch(/^[1-9]\d{0,2}$/);
  });

  it("draws each flag from the country code", () => {
    expect(CALLING_CODES.find((c) => c.label === "India")?.flag).toBe("🇮🇳");
    expect(CALLING_CODES.find((c) => c.label === "United Kingdom")?.flag).toBe("🇬🇧");
  });

  it("starts on the United States", () => {
    expect(CALLING_CODES.find((c) => c.label === DEFAULT_COUNTRY)?.code).toBe(
      DEFAULT_CALLING_CODE,
    );
  });
});
