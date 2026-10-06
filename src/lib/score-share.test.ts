import { describe, expect, it } from "vitest";
import { SHARE_PITCH, SHARE_URL, shareCaption } from "./score-share";

describe("shareCaption", () => {
  const caption = shareCaption({ live: 63, band: "moderate risk" });

  it("marks every Likeness Health Score with ℠", () => {
    expect(caption).toMatch(/Likeness Health Score/);
    expect(caption).not.toMatch(/Likeness Health Score(?!℠)/);
  });

  it("closes on the pitch, with the link on a line of its own", () => {
    expect(caption.endsWith(`find out.\n${SHARE_URL}`)).toBe(true);
  });
});

describe("SHARE_PITCH", () => {
  // The poster prints these lines one by one, so a mark missing here is missing
  // from the picture too.
  it("marks the name wherever it names it", () => {
    for (const line of SHARE_PITCH.flat()) {
      expect(line).not.toMatch(/Likeness Health Score(?!℠)/);
    }
  });
});
