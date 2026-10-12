// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { factorIconOf, riskFactorsFrom, type RiskFactor } from "./score";

describe("factorIconOf", () => {
  it("picks a quiz factor's glyph by its question key, however the key is spelled", () => {
    expect(factorIconOf({ kind: "quiz", key: "age" })).toBe("calendar");
    expect(factorIconOf({ kind: "quiz", key: "gender" })).toBe("person");
    expect(factorIconOf({ kind: "quiz", key: "posting_volume" })).toBe("globe");
    expect(factorIconOf({ kind: "quiz", key: "postingVolume" })).toBe("globe");
    expect(factorIconOf({ kind: "quiz", key: "Content Type" })).toBe("eye");
  });

  it("gives the monitoring question the shield, by either quiz's key", () => {
    expect(factorIconOf({ kind: "quiz", key: "q_il8uju" })).toBe("shield");
    expect(factorIconOf({ kind: "quiz", key: "discovery_method" })).toBe("shield");
  });

  it("gives a quiz key it doesn't know the shield, not another question's glyph", () => {
    expect(factorIconOf({ kind: "quiz", key: "favourite_colour" })).toBe("shield");
  });

  it("gives every threat the report glyph, whatever its event id", () => {
    expect(factorIconOf({ kind: "threat", key: "evt_7f3a" })).toBe("report");
  });

  /* Kind is asked first: an event id is not a question key, even when it reads like one. */
  it("never lets a threat borrow a quiz glyph through its key", () => {
    expect(factorIconOf({ kind: "threat", key: "age" })).toBe("report");
  });
});

describe("riskFactorsFrom", () => {
  const AGE: RiskFactor = { kind: "quiz", key: "age", title: "Age", line: "A line.", points: 6 };
  const THREAT: RiskFactor = {
    kind: "threat",
    key: "evt_1",
    title: "A live incident",
    line: "Another line.",
    points: 9,
  };

  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("keeps the served list as served — same order, same strings", () => {
    expect(riskFactorsFrom([AGE, THREAT])).toStrictEqual([AGE, THREAT]);
    expect(riskFactorsFrom([THREAT, AGE])).toStrictEqual([THREAT, AGE]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads an empty list as empty, quietly", () => {
    expect(riskFactorsFrom([])).toStrictEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads anything but a list as none, and says so", () => {
    for (const raw of [undefined, null, {}, "Age"]) expect(riskFactorsFrom(raw)).toStrictEqual([]);
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("drops an entry off the contract and keeps the rest in order", () => {
    const served = [
      AGE,
      { ...AGE, kind: "photo" },
      { ...AGE, title: "  " },
      { ...AGE, line: undefined },
      { ...AGE, points: "6" },
      null,
      THREAT,
    ];

    expect(riskFactorsFrom(served)).toStrictEqual([AGE, THREAT]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
