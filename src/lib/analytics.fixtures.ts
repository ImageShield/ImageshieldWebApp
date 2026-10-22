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
