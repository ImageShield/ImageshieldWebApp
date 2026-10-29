/**
 * How a Likeness Health Score is presented.
 *
 * The API owns the numbers — it scores the answers, picks the band, and returns the
 * per-factor breakdown. Nothing here recomputes any of that; this is the copy, the
 * colours and the gauge geometry that turn its response into the result screen.
 *
 * Client-safe: the screen renders straight from it.
 */
import type { GeneralRecommendation } from "./recommendations";

/** One entry of `breakdown.quiz` — a question, what it was answered, what it cost. */
export type QuizFactor = {
  key: string;
  /** The option given. A multi-select answer may be a list or the selections joined
   *  with ", ". */
  value: string | string[];
  /** POSITIVE, and subtracted. The legacy backend sent this as a negative number,
   *  which is why `topFactors` now sorts the other way round. */
  deduction: number;
  type: string;
};

/** One entry of `breakdown.dynamic` — exposure found in monitored sources. */
export type DynamicFactor = {
  id: string;
  points: number;
  active: boolean;
};

/**
 * One entry of `score.risk_factors` — something that lowered this score.
 *
 * Not every factor is a quiz answer. `quiz` is an answer the visitor gave, keyed by
 * the question's key; `threat` is a live incident affecting people who answered like
 * this visitor, keyed by its event id. A threat lowers the score the way an answer
 * does, which is why both sit under the same "risk factors" heading.
 */
export type RiskFactor = {
  kind: "quiz" | "threat";
  key: string;
  /** Short — "Age". Rendered as served. */
  title: string;
  /** One or two sentences, drafted from cited research. Rendered as served. */
  line: string;
  /** What it took off the score. Not shown. */
  points: number;
};

export type Score = {
  /** The number to show. The legacy record called this `score`. */
  live: number;
  /** "low risk" | "moderate risk" | "high risk" | "severe risk". */
  band: string;
  baseline: number;
  recovered: number;
  escrow_released: number;
  dynamic_deduction: number;
  /** What this account can reach today. A new one is capped below 100. */
  current_ceiling: number;
  /** What that ceiling rises to after enough days of monitoring. */
  maximum_ceiling: number;
  scoring_version: string;
  quiz_version: string;
  computed_at: string;
  breakdown: {
    quiz: QuizFactor[];
    dynamic: DynamicFactor[];
    escrow: { next_milestone_days: number | null };
  };
  /** At most three, ranked by the API, biggest first. Empty or absent hides the card.
   *
   *  Optional because the API may not send it until research is published. */
  risk_factors?: RiskFactor[];
};

/**
 * Both `POST /v1/quiz/responses` and `GET /v1/me/score` answer with this envelope.
 *
 * `score` can be null on a fresh submit — the answers are banked and the number is
 * still being worked out — which is a state to render, not a failure.
 *
 * `scope_note` is not decoration. The API attaches it to every score response
 * because the score means "likeness-protection health in MONITORED SOURCES" and
 * never "you are safe across the web"; 100 is not an all-clear. It is meant to be
 * shown, and the result screen shows it.
 */
export type ScoreEnvelope = {
  score: Score | null;
  scope_note: string;
  /** At most three, in reading order, the same for every visitor. Beside the score
   *  rather than inside it, so it arrives even when `score` is null.
   *
   *  Optional because the API may not send it until research is published.
   *  Empty or absent hides the card. */
  general_recommendations?: GeneralRecommendation[];
};

/**
 * The part of a score the result screen and the share poster actually read.
 *
 * Narrower than `Score` on purpose. The screen usually renders `GET /v1/me/score`,
 * but an account whose quiz was answered against a retired version gets no record
 * there — it is shown the score stored on its account instead, which `GET /v1/me`
 * carries without most of these fields. Both fit this.
 */
export type DisplayedScore = Pick<Score, "live" | "band">;

/** What the result screen renders: the envelope plus who is looking at it. */
export type ScoreRecord = {
  score: DisplayedScore;
  scopeNote: string;
  /** From `GET /v1/me`, not from a cookie — the person record is the one source. */
  firstName: string;
  /** `score.risk_factors` in the API's order. Empty hides the card. */
  riskFactors: RiskFactor[];
  /** `general_recommendations` likewise. Empty hides the card. */
  recommendations: GeneralRecommendation[];
};

export type RiskLevel = "high" | "moderate" | "low";

/**
 * The band the gauge is DRAWN in, which is not the same thing as the band the API
 * reports.
 *
 * /v1 has four: `low risk` (80+), `moderate risk` (55+), `high risk` (30+) and
 * `severe risk` (0+). The gauge is drawn with three, at 50 and 80 — the design's own
 * scale, kept deliberately rather than redrawn.
 *
 * So this maps the served band onto a colour, and `bandLabel` renders the served
 * string itself. `severe risk` takes the high-risk colour: it is the worse end of
 * the same red, and inventing a fourth colour would put a swatch on the screen that
 * the printed scale underneath has no segment for.
 *
 * What this must NOT do is decide the band from the number. Two threshold tables
 * drift, and the API says so in as many words — the arc here starts at 50 while the
 * API's moderate band starts at 55, so a score of 52 sits in the drawn moderate
 * stretch and is honestly labelled "high risk" beside it. The label is the truth;
 * the arc is a picture.
 */
const BAND_LEVELS: Record<string, RiskLevel> = {
  "low risk": "low",
  "moderate risk": "moderate",
  "high risk": "high",
  "severe risk": "high",
};

export function riskLevelOf(score: { band: string }): RiskLevel {
  // Unknown bands (a scoring version this release predates) take the middle colour
  // rather than the alarming one — the served label still says what it really is.
  return BAND_LEVELS[score.band.trim().toLowerCase()] ?? "moderate";
}

/**
 * The served band as a word: "moderate risk" → "Moderate".
 *
 * Rendered from the response rather than looked up, so a band this release has never
 * heard of still appears by its real name instead of being silently relabelled.
 */
export function bandLabel(score: { band: string }): string {
  const word = score.band.trim().replace(/\s*risk$/i, "");
  if (word === "") return score.band;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* ── Gauge geometry ───────────────────────────────────────────────────────────
 *
 * Measured off the design's 1440-wide export. Angles are SVG degrees — clockwise
 * from three o'clock, because y runs down — so the arc opens at the bottom: it
 * starts at 150° (lower left), climbs over the top, and ends at 390°, i.e. 30°
 * (lower right). 240° of sweep in all.
 *
 * The three bands are NOT proportional to the score ranges they cover — 0–50 is
 * half the scale but under a third of the arc. The design draws them at these
 * angles, and the printed 50 / 80 sit in the gaps, so the labels stay truthful
 * about where each drawn band starts even though the arc is not to scale.
 */
export const GAUGE = {
  /** Centre-line radius of the stroke, and the stroke's own width. */
  radius: 137,
  stroke: 26,
  start: 150,
  end: 390,
  /** Where one band's arc ends and the next begins, before the gap is cut out. */
  breaks: [223.5, 313.5],
  /** Angular slice removed at each break so the bands read as separate segments. */
  gap: 3,
} as const;

/**
 * How far a rounded tip reaches past the centre line it sits on, in degrees.
 *
 * `start` and `end` are where the gauge visually *finishes*, tip included, so the
 * stroke's centre line has to stop short of both by this much — otherwise the cap
 * overshoots the scale and runs into the 0 and 100 printed underneath it.
 */
const TIP_ANGLE = (Math.asin(GAUGE.stroke / 2 / GAUGE.radius) * 180) / Math.PI;

/** Centre-line angle of score 0 and score 100 — the drawn ends, tips excluded. */
const ANGLE_0 = GAUGE.start + TIP_ANGLE;
const ANGLE_100 = GAUGE.end - TIP_ANGLE;

export type GaugeSegmentKey = "0-50" | "50-80" | "80-100";

/**
 * The arc is drawn as a fill from 0 up to the score, split at the drawn boundaries
 * — not as a highlight of the band the score lands in. Same as the app's gauge, and
 * the reason the design shows the whole 0–50 arc coloured for a score of 49.
 */
export const GAUGE_SEGMENTS: ReadonlyArray<{
  key: GaugeSegmentKey;
  from: number;
  to: number;
}> = [
  { key: "0-50", from: 0, to: 50 },
  { key: "50-80", from: 50, to: 80 },
  { key: "80-100", from: 80, to: 100 },
];

/**
 * Gradient stops per band, top of the gauge → bottom.
 *
 * Copied verbatim from the app's `ScoreGauge.jsx` GAUGE_THEMES so a lead sees the
 * same arc on the web as in the app. The whole gauge takes ONE set, chosen by the
 * score's band; within a set each segment has its own pair. Some stops are
 * deliberately transparent — that is how the app fades the lower segments out — so
 * these are raw values rather than tokens.
 */
export const GAUGE_THEMES: Record<
  RiskLevel,
  Record<GaugeSegmentKey, readonly [string, string]>
> = {
  low: {
    "0-50": ["#39BEB7", "rgba(255,176,32,0.11)"],
    "50-80": ["#39BEB7", "#39BEB7"],
    "80-100": ["#39BEB7", "#39BEB7"],
  },
  moderate: {
    "0-50": ["rgba(255,176,32,0.9)", "rgba(255,176,32,0)"],
    "50-80": ["#FFB020", "rgba(255,176,32,0.7)"],
    "80-100": ["#FFB020", "rgba(255,176,32,0.7)"],
  },
  high: {
    "0-50": ["#DC2626", "#FFB020"],
    "50-80": ["#FF3B5C", "#DC2626"],
    "80-100": ["#FF3B5C", "#DC2626"],
  },
};

/**
 * Where a score sits on the arc.
 *
 * Piecewise, because the three drawn bands don't get arc in proportion to the scores
 * they cover — 0–50 is half the scale but under a third of the sweep. Interpolating
 * inside each band is what keeps the printed 50 and 80 sitting on the boundaries
 * they name.
 */
function scoreToAngle(score: number): number {
  const s = Math.min(Math.max(score, 0), 100);
  const [b50, b80] = GAUGE.breaks;
  if (s <= 50) return ANGLE_0 + (s / 50) * (b50 - ANGLE_0);
  if (s <= 80) return b50 + ((s - 50) / 30) * (b80 - b50);
  return b80 + ((s - 80) / 20) * (ANGLE_100 - b80);
}

/** Centre-line span of the whole track, tips excluded. */
export const GAUGE_TRACK = { from: ANGLE_0, to: ANGLE_100 } as const;

/**
 * How far the fill's rounded end is held back from a band boundary.
 *
 * Without it, a score just short of 50 or 80 puts the tip's centre close enough to
 * the divider that half the disc renders on the far side of the white slot — a
 * detached crumb of colour sitting in the next band. The app's `endClearAngle`,
 * same derivation: half a stroke plus a bit, as an angle at this radius.
 */
const TIP_CLEARANCE =
  (((GAUGE.stroke / 2 + GAUGE.stroke * 0.3) / GAUGE.radius) * 180) / Math.PI;

export type GaugeFill = {
  /** Drawn stretches, in order, each with the gradient key to paint it with. */
  segments: Array<{ key: GaugeSegmentKey; from: number; to: number }>;
  /** Where the rounded start tip goes; null when there is nothing filled. */
  startAngle: number | null;
  /**
   * Where the rounded end tip goes, or null when the fill stops flush on a band
   * boundary — there the divider is the end, and a tip would spill past it.
   */
  endAngle: number | null;
  endKey: GaugeSegmentKey;
};

/** Resolves a score into the arcs and tips the gauge draws. */
export function gaugeFill(score: number): GaugeFill {
  const value = Math.min(Math.max(score, 0), 100);
  const filled = GAUGE_SEGMENTS.filter((seg) => value > seg.from);
  const active = filled[filled.length - 1];

  if (!active) {
    return {
      segments: [],
      startAngle: null,
      endAngle: null,
      endKey: GAUGE_SEGMENTS[0].key,
    };
  }

  const boundary = active.to < 100;
  /* Sitting exactly on 50 or 80: the band is full, so it ends against the divider
     with a square edge rather than a tip. */
  const flush = boundary && value >= active.to;

  let end = scoreToAngle(Math.min(value, active.to));
  if (boundary && !flush) {
    end = Math.min(end, scoreToAngle(active.to) - TIP_CLEARANCE);
  }

  return {
    segments: filled.map((seg) => ({
      key: seg.key,
      from: scoreToAngle(seg.from),
      to: seg === active ? end : scoreToAngle(seg.to),
    })),
    startAngle: scoreToAngle(0),
    endAngle: flush ? null : end,
    endKey: active.key,
  };
}

/** A point on the gauge's centre line, in a viewBox centred on the arc. */
/* `radius` is annotated, not just defaulted: `GAUGE` is `as const`, so inferring
   from the default would narrow the parameter to the literal 137. */
export function gaugePoint(degrees: number, radius: number = GAUGE.radius) {
  const rad = (degrees * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

/**
 * The scale printed under the gauge.
 *
 * The three DRAWN bands and their ranges, which is the same scale the arc is divided
 * at — 0–49, 50–79, 80–100 — and not the API's four-band table. It is a key to the
 * picture above it, so it has to agree with the picture; the headline beside it is
 * where the served band is stated, and that remains the authoritative one. See the
 * note on BAND_LEVELS for why the two are deliberately allowed to differ.
 *
 * The colours are the flat band inks rather than the arc's gradients — a 2px rule
 * painted with a gradient that fades to transparent would simply disappear.
 *
 * Ordered worst-first, because the arc above it is: the gauge sweeps 0 at the
 * bottom-left up through 50 and 80 to 100 at the bottom-right, so a key that ran
 * the other way would put "Low Risk" under the stretch of arc that means high.
 * The mobile export is drawn this way round; the desktop one was built from a
 * legend that ran low-first, which is the reading this corrects.
 */
export const RISK_LEGEND: ReadonlyArray<{
  level: RiskLevel;
  label: string;
  range: string;
  /** CSS colour, so the rule can be painted without an interpolated class name. */
  colour: string;
}> = [
  { level: "high", label: "High Risk", range: "0–49", colour: "var(--color-risk-high)" },
  {
    level: "moderate",
    label: "Moderate Risk",
    range: "50–79",
    colour: "var(--color-risk-moderate)",
  },
  { level: "low", label: "Low Risk", range: "80–100", colour: "var(--color-risk-low)" },
];

/* ── The risk factors card ───────────────────────────────────────────────────
 *
 * The API picks, ranks and words the factors (`score.risk_factors`). The screen draws
 * them in the order served and supplies one thing the response doesn't carry: the
 * glyph in each disc.
 *
 * The glyph is chosen on `kind` first and `key` second. A quiz factor's key is the
 * question's own answer key, which is the server's to choose, so it is matched as a
 * normalised alias — `posting_volume`, `postingVolume` and `Posting Volume` all find
 * the same entry. A threat's key is an event id, which names nothing a glyph could
 * stand for, so every threat takes one glyph; and because kind is asked first, an
 * event id that happened to read "age" can't borrow the calendar.
 *
 * This table used to carry a title and a sentence per question as well. Those were
 * unsourced — the age line told a 55+ visitor their bracket was "the highest risk
 * demographic" — and the API now serves both, so only the glyphs are left.
 */
export type FactorIcon =
  | "calendar"
  | "person"
  | "globe"
  | "eye"
  | "report"
  | "shield"
  | "wand";

const QUIZ_FACTOR_ICONS: ReadonlyArray<{
  icon: FactorIcon;
  aliases: readonly string[];
}> = [
  { icon: "calendar", aliases: ["age", "agerange", "dateofbirth"] },
  /* A neutral glyph, not the Venus sign the export drew: that card only ever spoke
     about women, and a factor for a non-binary or male visitor's answer drawn with
     ♀ would misgender them in the one place the screen is about them. */
  { icon: "person", aliases: ["gender"] },
  {
    icon: "globe",
    aliases: [
      /* `privacy` is the live quiz's own key for this question. */
      "privacy",
      "visibility",
      "profilevisibility",
      "accountprivacy",
      "publicsocialaccounts",
      "platforms",
      "socialplatforms",
      "contentquantity",
      "contentvolume",
      "postingfrequency",
      "postingvolume",
    ],
  },
  { icon: "eye", aliases: ["contenttype", "typeofcontent"] },
  { icon: "shield", aliases: ["pastexploitation", "priormisuse", "confirmedtakedown"] },
  /* How the visitor watches for misuse: `q_il8uju` on v17, `discovery_method` on v11. */
  { icon: "shield", aliases: ["qil8uju", "discoverymethod", "monitoring"] },
  { icon: "report", aliases: ["activereports", "reports", "activematches"] },
];

/** Lowercase, letters and digits only — so one entry catches every spelling. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const ICON_BY_ALIAS = new Map(
  QUIZ_FACTOR_ICONS.flatMap(({ icon, aliases }) =>
    aliases.map((alias) => [alias, icon] as const),
  ),
);

/**
 * The glyph for one factor's disc.
 *
 * A threat takes the document glyph — the one this screen already drew for "Active
 * Reports", misuse happening now, which is what a live incident is. A quiz key no
 * alias claims takes the shield, rather than some other question's glyph.
 */
export function factorIconOf(factor: Pick<RiskFactor, "kind" | "key">): FactorIcon {
  if (factor.kind === "threat") return "report";
  return ICON_BY_ALIAS.get(normalizeKey(factor.key)) ?? "shield";
}

/**
 * `score.risk_factors`, checked against the contract on its way in.
 *
 * Checked rather than trusted because `call<T>` types an answer by assertion, so this
 * is the first place a missing field can surface — and unchecked it surfaces as a
 * crash on `.map` for every visitor, if this ships ahead of the API. Anything but a
 * list reads as none, and an entry that doesn't match the contract is dropped rather
 * than drawn as a blank or mislabelled row. The rest keep the API's order: nothing is
 * sorted, picked or backfilled here.
 */
export function riskFactorsFrom(raw: unknown): RiskFactor[] {
  if (!Array.isArray(raw)) {
    console.warn("score response: risk_factors is not a list; card hidden");
    return [];
  }

  const kept = raw.filter(isRiskFactor);
  if (kept.length < raw.length) {
    console.warn(`score response: dropped ${raw.length - kept.length} malformed risk_factors`);
  }
  return kept;
}

function isRiskFactor(value: unknown): value is RiskFactor {
  if (typeof value !== "object" || value === null) return false;
  const { kind, key, title, line, points } = value as Record<string, unknown>;
  return (
    (kind === "quiz" || kind === "threat") &&
    typeof key === "string" &&
    typeof title === "string" &&
    title.trim() !== "" &&
    typeof line === "string" &&
    line.trim() !== "" &&
    typeof points === "number"
  );
}
