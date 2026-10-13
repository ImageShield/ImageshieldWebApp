// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { ScoreLoad } from "@/lib/score-record";
import { loadScore } from "@/lib/score-record";
import { POSTER_SIZE } from "@/lib/score-share";
import { GET } from "./route";

/* Only the score read is replaced; satori, resvg and the fonts on disk run as they
   do in production. */
vi.mock("@/lib/score-record", () => ({ loadScore: vi.fn() }));

const served = (live: number, band: string) =>
  vi.mocked(loadScore).mockResolvedValue({
    ok: true,
    record: { score: { live, band } },
  } as unknown as ScoreLoad);

/** Checks the bytes are a whole PNG, not just its first chunk, and decodes them. */
async function poster(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  expect(buf.subarray(-8, -4).toString("latin1")).toBe("IEND");
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), px };
}

const near = (rgb: number[], hex: string) => {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  rgb.forEach((v, i) => expect(Math.abs(v - want[i])).toBeLessThanOrEqual(6));
};

describe("GET /api/share/score-card", () => {
  it("draws the whole poster as a PNG, uncached", async () => {
    served(62, "moderate risk");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("no-store, private");
    const png = await poster(res);
    expect([png.width, png.height]).toEqual([POSTER_SIZE.width, POSTER_SIZE.height]);
    // The backdrop's gradient ends, so a blank or transparent canvas fails here.
    near(png.px(2, 2), "#7F48FF");
    near(png.px(2, POSTER_SIZE.height - 3), "#380E99");
  });

  it("still draws once sharp refuses SVG, as Next's image optimizer leaves it", async () => {
    // Next's `getSharp` in server/image-optimizer.js, verbatim. libvips holds the
    // block for the whole process, which is what broke `ImageResponse`.
    sharp.block({ operation: ["VipsForeignLoad"] });
    sharp.unblock({
      operation: [
        "VipsForeignLoadHeif",
        "VipsForeignLoadJpeg",
        "VipsForeignLoadNsgif",
        "VipsForeignLoadPng",
        "VipsForeignLoadTiff",
        "VipsForeignLoadWebp",
      ],
    });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>',
    );
    await expect(sharp(svg).png().toBuffer()).rejects.toThrow(
      "unsupported image format",
    );

    for (const [live, band] of [
      [91, "low risk"],
      [62, "moderate risk"],
      [12, "severe risk"],
    ] as const) {
      served(live, band);
      const res = await GET();
      expect(res.status).toBe(200);
      const png = await poster(res);
      expect([png.width, png.height]).toEqual([POSTER_SIZE.width, POSTER_SIZE.height]);
    }
  });

  it("draws a band it has never heard of and a score off the scale", async () => {
    served(140, "catastrophic risk");
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await poster(res)).width).toBe(POSTER_SIZE.width);
  });

  it.each([
    ["signed-out", 401],
    ["stale", 401],
    ["missing", 404],
    ["outdated", 409],
    ["pending", 409],
    ["unavailable", 502],
    ["something new", 502],
  ])("answers a %s score with %i and no picture", async (reason, status) => {
    vi.mocked(loadScore).mockResolvedValue({ ok: false, reason } as ScoreLoad);
    const res = await GET();
    expect(res.status).toBe(status);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ error: "No score to share", reason });
  });
});
