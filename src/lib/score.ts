/**
 * How a Likeness Health Score is presented.
 *
 * The API owns the numbers — it scores the answers, picks the band, and returns the
 * per-factor breakdown. Nothing here recomputes any of that; this is the copy, the
 * colours and the gauge geometry that turn its response into the result screen.
 *
 * Client-safe: the screen renders straight from it.
 */

/** One entry of `breakdown.quiz` — a question, what it was answered, what it cost. */
export type QuizFactor = {
  key: string;
  value: string;
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
};

/**
 * The part of a score the result screen and the share poster actually read.
 *
 * Narrower than `Score` on purpose. The screen usually renders `GET /v1/me/score`,
 * but an account whose quiz was answered against a retired version gets no record
 * there — it is shown the score stored on its account instead, which `GET /v1/me`
 * carries without most of these fields. Both fit this.
 */
export type DisplayedScore = Pick<Score, "live" | "band"> & {
  breakdown: Pick<Score["breakdown"], "quiz">;
};

/** What the result screen renders: the envelope plus who is looking at it. */
export type ScoreRecord = {
  score: DisplayedScore;
  scopeNote: string;
  /** From `GET /v1/me`, not from a cookie — the person record is the one source. */
  firstName: string;
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

/* ── What affected your score ────────────────────────────────────────────────
 *
 * The design shows three cards, and a real breakdown has as many entries as the
 * quiz has scored questions. So the cards are filled from the three biggest
 * deductions and this table supplies the icon and the sentence for whichever ones
 * turn up.
 *
 * Keyed by ALIAS rather than by one exact string, and this is the part that changed.
 * The legacy backend named its factors in prose ("Profile Visibility", "Content
 * Type") and this table matched them verbatim. /v1 names them by the quiz's own
 * answer keys, which are the server's to choose and are not visible from here
 * without a session. Matching on a normalised token means the same entry is found
 * whether the key arrives as `contentType`, `content_type` or `Content Type`, so the
 * marketing copy survives a naming convention this side doesn't control.
 *
 * A factor no alias matches is NOT dropped and is not given someone else's sentence.
 * It falls back to the quiz's own wording for that question — see `topFactors`.
 */
export type FactorIcon =
  | "calendar"
  | "venus"
  | "globe"
  | "eye"
  | "report"
  | "shield"
  | "wand";

const FACTOR_PRESENTATION: ReadonlyArray<{
  aliases: readonly string[];
  title: string;
  icon: FactorIcon;
  description: string;
}> = [
  {
    aliases: ["age", "agerange", "dateofbirth"],
    title: "Age",
    icon: "calendar",
    description:
      "Adults 19–35 account for 75% of deepfake victims globally. Your age bracket is the highest risk demographic",
  },
  {
    aliases: ["gender"],
    title: "Gender",
    icon: "venus",
    description:
      "96% of non-consensual deepfake content targets women. Gender is one of the strongest predictors of targeting risk",
  },
  {
    aliases: [
      /* `privacy` is the live quiz's own key for this question, and its absence
         showed up as the card falling back to the raw prompt. */
      "privacy",
      "visibility",
      "profilevisibility",
      "accountprivacy",
      "publicsocialaccounts",
    ],
    title: "Privacy Settings",
    icon: "globe",
    description:
      "Current social media exposure levels provide significant training data for unauthorized AI models.",
  },
  {
    aliases: ["platforms", "socialplatforms"],
    title: "Platforms",
    icon: "globe",
    description:
      "Each platform your likeness sits on is another source a collector can scrape it from.",
  },
  {
    aliases: ["contenttype", "typeofcontent"],
    title: "Content Type",
    icon: "eye",
    description:
      "The kind of content you share changes how valuable your likeness is to the people collecting it.",
  },
  {
    aliases: [
      "contentquantity",
      "contentvolume",
      "postingfrequency",
      "postingvolume",
    ],
    title: "Social activity",
    icon: "globe",
    description:
      "Regular public posting increases your likeness exposure 5×. Your social footprint puts you at a higher risk of having your likeness harvested.",
  },
  {
    aliases: ["pastexploitation", "priormisuse", "confirmedtakedown"],
    title: "Past Exploitation",
    icon: "shield",
    description:
      "A prior incident raises your risk: likeness that has been misused once is more likely to be misused again.",
  },
  {
    aliases: ["activereports", "reports", "activematches"],
    title: "Active Reports",
    icon: "report",
    description:
      "Open reports on your account mean your likeness is being misused right now.",
  },
];

/** Lowercase, letters and digits only — so one entry catches every spelling. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_ALIAS = new Map(
  FACTOR_PRESENTATION.flatMap((entry) =>
    entry.aliases.map((alias) => [alias, entry] as const),
  ),
);

/** "content_type" → "Content type", for a factor no alias claims. */
function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export type PresentedFactor = {
  key: string;
  title: string;
  icon: FactorIcon;
  description: string;
};

/**
 * The three the export names, in its order: Age, Gender, Social activity.
 *
 * Pinned rather than picked by deduction, and that is a change worth being explicit
 * about. Sorting by what cost the most points is the more informative rule, but it
 * surfaces whichever questions happen to score worst for this person — which meant
 * the card could show "Privacy Settings" and "Platforms", two entries whose copy
 * predates this design and reads nothing like the three the export writes.
 *
 * These three are safe to pin because the live quiz asks all of them of everyone:
 * none is conditional and none is optional, so there is always an answer behind each
 * card. What is NOT guaranteed is that each cost points — a card can therefore name
 * something that did not push this particular score down, which is why the card is
 * headed "Your risk factors" rather than "What lowered your score".
 */
const REPORT_FACTORS = ["age", "gender", "posting_volume"] as const;

/** One breakdown entry, dressed for a card. */
function present(
  factor: QuizFactor,
  prompts: ReadonlyMap<string, string>,
): PresentedFactor {
  const preset = BY_ALIAS.get(normalizeKey(factor.key));
  if (preset) {
    return {
      key: factor.key,
      title: preset.title,
      icon: preset.icon,
      description: preset.description,
    };
  }
  /* No presentation entry: show the real question and the real answer rather than a
     generic line or a raw slug. */
  const prompt = prompts.get(factor.key);
  return {
    key: factor.key,
    title: humanizeKey(factor.key),
    icon: "shield" as FactorIcon,
    description: prompt
      ? `${prompt} You answered “${factor.value}”.`
      : `You answered “${factor.value}”.`,
  };
}

/**
 * The cards under "Your risk factors".
 *
 * `prompts` maps an answer key to the question it was asked as, read from the same
 * quiz definition the visitor answered — the fallback for a key no alias claims.
 *
 * Backfilled by deduction when the pinned set can't be filled, so a server that
 * renames or drops one of those questions costs the card one entry rather than
 * leaving a hole in the design.
 */
export function reportFactors(
  breakdown: QuizFactor[],
  prompts: ReadonlyMap<string, string> = new Map(),
  count = 3,
): PresentedFactor[] {
  const byKey = new Map(
    breakdown.map((factor) => [normalizeKey(factor.key), factor] as const),
  );

  const chosen: QuizFactor[] = [];
  for (const key of REPORT_FACTORS) {
    const factor = byKey.get(normalizeKey(key));
    if (factor) chosen.push(factor);
  }

  if (chosen.length < count) {
    const taken = new Set(chosen.map((factor) => factor.key));
    const rest = breakdown
      .filter((factor) => !taken.has(factor.key) && factor.deduction > 0)
      /* /v1 sends `deduction` as a positive number of points subtracted; the legacy
         backend sent it negative and this sorted the other way round. */
      .sort((a, b) => b.deduction - a.deduction);
    for (const factor of rest) {
      chosen.push(factor);
      if (chosen.length === count) break;
    }
  }

  return chosen.slice(0, count).map((factor) => present(factor, prompts));
}
