import { GAUGE_THEMES, type RiskLevel } from "@/lib/score";

/**
 * The gauge on the shared poster: the app's `ScoreGauge`, `report` variant - the one
 * its own share card photographs - drawn as an SVG string.
 *
 * Not the result page's gauge. That one is drawn from the desktop export, at a
 * slightly different stroke and with its labels inside the drawing; this picture is
 * meant to be the same picture the app posts, so it takes the app's numbers.
 *
 * Everything is in the app's 164×160 frame. The caller scales the whole thing by
 * giving it a pixel width, and draws the text over it itself: the route rasterises
 * with resvg and no fonts loaded, so `<text>` in here would come out blank. `CENTER`
 * and `TICKS` are where that text goes.
 */
export const FRAME = { width: 164, height: 160 } as const;

/**
 * Drawn room above the frame. The arc's outer edge peaks half a unit above y=0 -
 * the app clips that half unit, and at 1080px it shows as a flat top on the track.
 * The SVG is drawn this much taller, upward, and placed this much higher.
 */
export const HEADROOM = 1;

const CX = 81.571;
const CY = 79.495;
const R = 72.28;
const SW = 15.46;
/** Score 0 and score 100, in degrees anticlockwise from three o'clock. */
const START = 211.11;
const END = -28.7;
/** The 50 and 80 boundaries. */
const DIVS = [136.83, 45.83] as const;

/** "Risk Level" over the band word, centred on the arc: baselines and sizes. */
export const CENTER = { x: 81.6, labelY: 67, labelSize: 12, valueY: 90, valueSize: 16 } as const;

/** The scale's four numbers, each placed where the app's export puts it (baselines). */
export const TICKS = [
  { value: "0", x: 21.16, y: 132.11 },
  { value: "50", x: 11.9, y: 17.14 },
  { value: "80", x: 147, y: 17.06 },
  { value: "100", x: 135.05, y: 129.16 },
] as const;

const SEGMENTS = [
  { key: "0-50", from: 0, to: 50 },
  { key: "50-80", from: 50, to: 80 },
  { key: "80-100", from: 80, to: 100 },
] as const;

function point(degrees: number, radius = R) {
  const rad = (degrees * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function arc(from: number, to: number): string {
  const s = point(from);
  const e = point(to);
  const large = from - to > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Piecewise, as the app's: the drawn bands don't get arc in proportion to score. */
function angleOf(score: number): number {
  const [d50, d80] = DIVS;
  if (score <= 50) return START - (score / 50) * (START - d50);
  if (score <= 80) return d50 - ((score - 50) / 30) * (d50 - d80);
  return d80 - ((score - 80) / 20) * (d80 - END);
}

/**
 * `level` picks the colour set, and is the served band's - the same one the page
 * colours its own gauge by - rather than the app's own thresholds.
 */
export function posterGaugeSvg(score: number, level: RiskLevel): string {
  const value = Math.min(Math.max(score, 0), 100);
  const theme = GAUGE_THEMES[level];

  /* A fill that stops inside a band is held clear of the next divider, or its end
     reads as a crumb on the far side of the slot. The app's `endClearAngle`. */
  const endSeg = SEGMENTS.find((s) => value <= s.to) ?? SEGMENTS[2];
  const clear = (((SW / 2 + SW * 0.3) / R) * 180) / Math.PI;
  let endAngle = angleOf(value);
  if (endSeg.to < 100 && value < endSeg.to) {
    endAngle = Math.max(endAngle, angleOf(endSeg.to) + clear);
  }

  const gradients = SEGMENTS.map(
    (s) =>
      `<linearGradient id="g${s.key}" x1="${CX}" y1="${CY - R}" x2="${CX}" y2="${CY + R}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${theme[s.key][0]}"/><stop offset="1" stop-color="${theme[s.key][1]}"/>` +
      `</linearGradient>`,
  ).join("");

  const fill = SEGMENTS.map((s) => {
    const upTo = Math.min(value, s.to);
    if (upTo <= s.from + 0.01) return "";
    const to = s === endSeg ? endAngle : angleOf(upTo);
    return `<path d="${arc(angleOf(s.from), to)}" stroke="url(#g${s.key})" stroke-width="${SW}" fill="none"/>`;
  }).join("");

  const dividers = DIVS.map((deg) => {
    const a = point(deg, R - SW / 2 - 1);
    const b = point(deg, R + SW / 2 + 1);
    return `<path d="M${a.x.toFixed(2)} ${a.y.toFixed(2)} L${b.x.toFixed(2)} ${b.y.toFixed(2)}" stroke="#FFFFFF" stroke-width="4"/>`;
  }).join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${-HEADROOM} ${FRAME.width} ${FRAME.height + HEADROOM}">` +
    `<defs>${gradients}</defs>` +
    `<path d="${arc(START, END)}" stroke="#F1F2F6" stroke-width="${SW}" fill="none"/>` +
    fill +
    dividers +
    `</svg>`
  );
}
