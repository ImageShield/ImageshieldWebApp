/**
 * The result screen's two cards, built here until the API builds them.
 *
 * TEMPORARY. `score.risk_factors` and `general_recommendations` are the API's to
 * serve; until it does, this fills them from the visitor's own answers and the
 * published v17 evidence report. It fills a card while the API's field is missing,
 * null or empty; a list with entries is always the API's (see `resolve` in
 * `../score-record.ts`). The day the backend's lists carry research, this folder is
 * deleted and that file loses its fallback; nothing on the screen changes.
 *
 * The answers are read off the score record (`breakdown.quiz`), not out of the
 * browser tab: they are the ones the score was actually computed from. An app user
 * whose existing score `/api/quiz` kept still has a fresh set of web answers in the
 * tab, and those determined nothing.
 *
 * Which records it serves, and which of their questions, is ./versions.ts.
 *
 * Pure apart from its warnings, and deterministic: the same record always yields the
 * same cards in the same order.
 */

import type { QuizAnswers } from "../quiz";
import type { GeneralRecommendation } from "../recommendations";
import type { RiskFactor, Score } from "../score";
import { type AnswerEvidence, QUESTIONS } from "./evidence-v17";
import { RECOMMENDATIONS_V17 } from "./recommendations-v17";
import { type VersionProfile, VERSIONS } from "./versions";

/** The design has room for three rows a card, and the API contract caps both at three. */
const MAX_ROWS = 3;

/** One submitted answer, looked up in the report. */
export type ClassifiedAnswer = {
  key: string;
  answer: string;
  /** Null when the report has no such question or answer: `unmatched`. */
  evidence: AnswerEvidence | null;
  /** The report's own position — question, then answer. Breaks ties in points. */
  order: number;
};

const QUESTION_BY_KEY = new Map(QUESTIONS.map((question) => [question.key, question]));

/** Where an answer sits in the report, as one sortable number. */
const ORDER = new Map<string, number>(
  QUESTIONS.flatMap((question, q) =>
    question.answers.map((entry, a) => [`${question.key}\u0000${entry.answer}`, q * 100 + a] as const),
  ),
);

/**
 * The answers on a score record, keyed like the quiz's own.
 *
 * `breakdown.quiz` is typed by assertion like every /v1 answer, so it is read as
 * unknown: an entry without a string key, or with a value that is neither a string
 * nor a list of them, is skipped.
 */
export function answersFrom(breakdown: unknown): QuizAnswers {
  const answers: QuizAnswers = {};
  if (!Array.isArray(breakdown)) return answers;

  for (const entry of breakdown) {
    if (typeof entry !== "object" || entry === null) continue;
    const { key, value } = entry as Record<string, unknown>;
    if (typeof key !== "string") continue;
    if (typeof value === "string") answers[key] = value;
    else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      answers[key] = value;
    }
  }
  return answers;
}

/**
 * What the record says each question cost, keyed like `answersFrom`. Only finite
 * numbers: a question with no usable deduction is left out, never priced at zero.
 */
export function deductionsFrom(breakdown: unknown): Record<string, number> {
  const deductions: Record<string, number> = {};
  if (!Array.isArray(breakdown)) return deductions;

  for (const entry of breakdown) {
    if (typeof entry !== "object" || entry === null) continue;
    const { key, deduction } = entry as Record<string, unknown>;
    if (typeof key === "string" && typeof deduction === "number" && Number.isFinite(deduction)) {
      deductions[key] = deduction;
    }
  }
  return deductions;
}

/**
 * A multi-select answer as the options it names.
 *
 * The breakdown's shape for one is unconfirmed: a list is the obvious reading, but the
 * dev fixture once sent the selections joined with ", ". Both are read. A joined
 * string is split only when every piece is an exact option — none of the v17
 * platforms contains a comma, so that split can't mistake one option for two — and is
 * otherwise kept whole, to fail as unmatched rather than be guessed at.
 */
function selectionsOf(given: string | string[], options: ReadonlySet<string>): string[] {
  if (Array.isArray(given)) return given;
  if (options.has(given)) return [given];
  const pieces = given.split(",").map((piece) => piece.trim());
  return pieces.every((piece) => options.has(piece)) ? pieces : [given];
}

/**
 * Each answer, looked up in the report. One entry per (question, option), so a
 * platform listed twice is classified once.
 */
export function classifyAnswers(answers: QuizAnswers): ClassifiedAnswer[] {
  const classified: ClassifiedAnswer[] = [];
  const seen = new Set<string>();

  for (const [key, given] of Object.entries(answers)) {
    const question = QUESTION_BY_KEY.get(key);
    const byAnswer = new Map(question?.answers.map((entry) => [entry.answer, entry]));

    /* A single-select question answered with a list is malformed; it is kept whole
       and comes out unmatched rather than having one of its values picked. */
    const selections = question?.multi
      ? selectionsOf(given, new Set(byAnswer.keys()))
      : [Array.isArray(given) ? given.join(", ") : given];

    for (const answer of selections) {
      const id = `${key}\u0000${answer}`;
      if (seen.has(id)) continue;
      seen.add(id);
      classified.push({
        key,
        answer,
        evidence: byAnswer.get(answer) ?? null,
        order: ORDER.get(id) ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }
  return classified;
}

/** Most points first; equal points in the report's own order. */
function byPointsThenReport(a: ClassifiedAnswer, b: ClassifiedAnswer): number {
  return (b.evidence?.points ?? 0) - (a.evidence?.points ?? 0) || a.order - b.order;
}

type BackedAnswer = ClassifiedAnswer & {
  evidence: Extract<AnswerEvidence, { status: "backed" }>;
};

const isBacked = (entry: ClassifiedAnswer): entry is BackedAnswer =>
  entry.evidence?.status === "backed";

/**
 * The risk factors card: the visitor's answers that cost the most published points,
 * among those the report backs with reasoning it could load.
 *
 * Only `backed` answers qualify, however many points another answer cost. An
 * unbacked one has nothing behind it to say, and saying something anyway is exactly
 * what the old hardcoded card did.
 */
export function riskFactorsFor(classified: readonly ClassifiedAnswer[]): RiskFactor[] {
  return classified
    .filter(isBacked)
    .sort(byPointsThenReport)
    .slice(0, MAX_ROWS)
    .map(({ key, evidence }) => ({
      kind: "quiz",
      key,
      title: evidence.title,
      line: evidence.line,
      points: evidence.points,
    }));
}

/**
 * The risk factors card for a record whose scoring the report doesn't price: one row
 * per question at most, ranked by what the record says that question cost.
 *
 * One row, because the record prices a question, not an option. Two platforms would
 * otherwise each be shown at the platforms question's whole deduction. Which platform
 * is the row is the report's call (its strongest backed one the visitor picked); what
 * it cost is the record's. A question that cost nothing, or whose cost the record
 * doesn't give, didn't "determine the score", so it isn't shown.
 */
export function riskFactorsByRecord(
  classified: readonly ClassifiedAnswer[],
  recorded: Readonly<Record<string, number>>,
): RiskFactor[] {
  const strongest = new Map<string, BackedAnswer>();
  for (const entry of classified.filter(isBacked).sort(byPointsThenReport)) {
    if (!strongest.has(entry.key)) strongest.set(entry.key, entry);
  }

  return [...strongest.values()]
    .flatMap((entry) => {
      const cost = Object.hasOwn(recorded, entry.key) ? recorded[entry.key] : undefined;
      return cost !== undefined && cost > 0 ? [{ entry, cost }] : [];
    })
    .sort((a, b) => b.cost - a.cost || a.entry.order - b.entry.order)
    .slice(0, MAX_ROWS)
    .map(({ entry: { key, evidence }, cost }) => ({
      kind: "quiz",
      key,
      title: evidence.title,
      line: evidence.line,
      points: cost,
    }));
}

/**
 * The recommendations card: each entry whose answers the visitor gave, ranked by the
 * most any of those answers cost — the report's points by default, or the record's
 * own deductions — then by catalogue order.
 *
 * Each entry is shown once however many of the visitor's answers call for it —
 * picking both Instagram and Facebook is one reporting tip, not two. A trigger with
 * no known cost still counts; it only sorts after those with one.
 */
export function recommendationsFor(
  classified: readonly ClassifiedAnswer[],
  costOf: (entry: ClassifiedAnswer) => number | undefined = (entry) => entry.evidence?.points,
): GeneralRecommendation[] {
  return RECOMMENDATIONS_V17.flatMap((recommendation, index) => {
    const triggers = classified.filter(
      (entry) =>
        entry.evidence !== null &&
        entry.key === recommendation.when.key &&
        recommendation.when.answers.includes(entry.answer),
    );
    if (triggers.length === 0) return [];
    const weight = Math.max(...triggers.map((entry) => costOf(entry) ?? -1));
    return [{ recommendation, weight, index }];
  })
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, MAX_ROWS)
    .map(({ recommendation: { title, body, link } }) => ({ title, body, link: { ...link } }));
}

export type LocalInsights = {
  riskFactors: RiskFactor[];
  recommendations: GeneralRecommendation[];
};

const NONE: LocalInsights = { riskFactors: [], recommendations: [] };

/** A record's keys in the report's terms, dropping what the version doesn't map. */
function inReportTerms<T>(byKey: Record<string, T>, questions: ReadonlyMap<string, string>) {
  const translated: Record<string, T> = {};
  for (const [key, value] of Object.entries(byKey)) {
    const reportKey = questions.get(key);
    if (reportKey !== undefined) translated[reportKey] = value;
  }
  return translated;
}

/** The version's profile, or none — own keys only, so "constructor" isn't a version. */
function profileFor(score: Pick<Score, "quiz_version" | "scoring_version">) {
  const profile: VersionProfile | undefined = Object.hasOwn(VERSIONS, score.quiz_version)
    ? VERSIONS[score.quiz_version]
    : undefined;
  if (profile === undefined) return undefined;
  if (profile.scoringVersion !== null && score.scoring_version !== profile.scoringVersion) {
    return undefined;
  }
  return profile;
}

/** What a value is, never what it says: "absent", "null", "list(3)", "string"… */
export function shapeOf(value: unknown): string {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  return Array.isArray(value) ? `list(${value.length})` : typeof value;
}

/**
 * The record as the engine sees it, for a log line — structure only.
 *
 * Versions, whether there is a profile for them, and per breakdown entry its question
 * key, the shape of its value, whether that value is an option the report lists (for
 * questions this version maps), and whether it carries a cost. Never an answer or a
 * cost itself: those are the visitor's age, gender and history.
 */
export function describeRecord(
  score: Pick<Score, "quiz_version" | "scoring_version"> & { breakdown?: { quiz?: unknown } },
): string {
  const profile = profileFor(score);
  const raw = score.breakdown?.quiz;
  const head = `${score.quiz_version} / ${score.scoring_version}, profile ${profile ? profile.rank : "none"}`;
  if (!Array.isArray(raw)) return `${head}, breakdown.quiz ${shapeOf(raw)}`;

  const questions = new Map(Object.entries(profile?.questions ?? {}));
  const entries = raw.map((entry) => {
    if (typeof entry !== "object" || entry === null) return shapeOf(entry);
    const { key, value, deduction } = entry as Record<string, unknown>;
    if (typeof key !== "string") return `key:${shapeOf(key)}`;
    const cost =
      typeof deduction === "number" ? (deduction > 0 ? "cost>0" : "cost<=0") : `cost:${shapeOf(deduction)}`;
    const reportKey = questions.get(key);
    let known: string;
    if (reportKey === undefined) {
      known = profile?.omitted.includes(key) ? "omitted" : "unmapped";
    } else if (typeof value === "string" || Array.isArray(value)) {
      const answers = classifyAnswers({ [reportKey]: value as string | string[] });
      known = answers.length > 0 && answers.every((a) => a.evidence !== null) ? "known" : "UNKNOWN";
    } else {
      known = "BAD-VALUE";
    }
    return `${key}:${shapeOf(value)}:${known}:${cost}`;
  });
  return `${head}, breakdown.quiz ${entries.length} [${entries.join(" ")}]`;
}

/**
 * Both cards for one score record.
 *
 * Only for a quiz version ./versions.ts lists, and only from the questions it maps —
 * any other version asked other questions, so it gets nothing, which hides both cards
 * rather than laying v17 research over answers it was never written about.
 *
 * Each way this comes back empty for a record that should have had cards is logged,
 * by version and question key only: the answers themselves are the visitor's age,
 * gender or history.
 */
export function localInsights(
  score: Pick<Score, "quiz_version" | "scoring_version"> & { breakdown?: { quiz?: unknown } },
): LocalInsights {
  const profile = profileFor(score);
  if (profile === undefined) {
    console.warn(
      `local insights: no evidence profile for ${score.quiz_version} / ${score.scoring_version}; cards hidden`,
    );
    return NONE;
  }

  const raw = score.breakdown?.quiz;
  const answers = answersFrom(raw);
  if (Object.keys(answers).length === 0) {
    console.warn(
      `local insights: ${score.quiz_version} record has no readable answers in its breakdown; cards hidden`,
    );
    return NONE;
  }

  const questions = new Map(Object.entries(profile.questions));
  const recordKey = new Map([...questions].map(([from, to]) => [to, from]));
  const classified = classifyAnswers(inReportTerms(answers, questions));

  /* Drift between the record and the tables here: a question neither mapped nor
     deliberately omitted, or an answer the report doesn't list. */
  const drift = new Set([
    ...Object.keys(answers).filter((key) => !questions.has(key) && !profile.omitted.includes(key)),
    ...classified.filter((e) => e.evidence === null).map((e) => recordKey.get(e.key) ?? e.key),
  ]);
  if (drift.size > 0) {
    console.warn(
      `local insights: no v17 evidence entry for ${score.quiz_version} answers to ${[...drift].join(", ")}`,
    );
  }

  let riskFactors: RiskFactor[];
  let recommendations: GeneralRecommendation[];
  if (profile.rank === "published") {
    riskFactors = riskFactorsFor(classified);
    recommendations = recommendationsFor(classified);
  } else {
    const recorded = inReportTerms(deductionsFrom(raw), questions);
    riskFactors = riskFactorsByRecord(classified, recorded);
    recommendations = recommendationsFor(classified, (entry) =>
      Object.hasOwn(recorded, entry.key) ? recorded[entry.key] : undefined,
    );
  }

  /* The factor names the question as this record's quiz does — `discovery_method` on
     v11, not the report's `q_il8uju`. */
  return {
    riskFactors: riskFactors.map((factor) => ({ ...factor, key: recordKey.get(factor.key) ?? factor.key })),
    recommendations,
  };
}
