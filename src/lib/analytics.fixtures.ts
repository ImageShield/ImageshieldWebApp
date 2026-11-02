import { QUIZ_ANALYTICS_MAP } from "./analytics-quiz-map";
import type { QuizDefinition } from "./quiz";

/** For the analytics tests: a reviewed version's definition, exactly as the API served it. */
export const definitionOf = (version: string): QuizDefinition => ({
  quiz_version: version,
  questions: QUIZ_ANALYTICS_MAP[version].map((q) => ({
    key: q.key,
    prompt: q.prompt,
    options: q.options,
    ...(q.multi ? { multi: true, required: false } : {}),
  })),
});

const ATTRIBUTION_KEYS = [
  "page_variant",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
  "msclkid",
];

/**
 * Events with the attribution fields taken off, for the tests that pin the quiz fields an
 * event carries. Attribution rides on every event now; analytics.attribution.test.ts is
 * where it is asserted, so those tests don't each repeat it.
 */
export const withoutAttribution = (events: unknown[]): unknown[] =>
  events.map((e) => Object.fromEntries(Object.entries(e as object).filter(([k]) => !ATTRIBUTION_KEYS.includes(k))));
