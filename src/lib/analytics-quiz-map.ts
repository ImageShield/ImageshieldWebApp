/**
 * The quiz versions whose answers have been reviewed for analytics, question by question.
 *
 * Copied from `GET /v1/quiz` on prod (v11) and dev (v17) on 2026-10-22, word for word.
 * An answer is only reported when the live definition still matches its entry here -
 * same position, wording, options and single/multi - so a version edited in place, or
 * a new one, reports progress but no answers until it is reviewed and added.
 *
 * `id` is what the dataLayer's `question` carries. It is the backend key except where
 * the same question is keyed differently between versions: the monitoring question is
 * `discovery_method` on v11 and `q_il8uju` on v17, and both report as
 * `monitoring_method` so one question has one name in the reports. (`discovery_method`
 * once asked how someone found out about abuse; the alias also keeps that meaning out
 * of the reports.)
 *
 * `forwardAnswer` is the proposal: whether that question's answer may go to GTM once
 * ANSWER_ANALYTICS_APPROVED is on. Age, gender and prior misuse are false - an age band,
 * a gender identity and a history of image abuse need their own legal decision, and the
 * backend already holds them for scoring if aggregate figures are wanted.
 */

export type MappedQuestion = {
  /** The backend's key in this version. */
  key: string;
  /** The `question` value reported. */
  id: string;
  /** One-based, in the order the definition serves. */
  position: number;
  prompt: string;
  multi: boolean;
  /** The canonical answer values: the option strings exactly as the API validates them. */
  options: readonly string[];
  forwardAnswer: boolean;
};

const AGE_OPTIONS = ["Under 18", "18-24", "25-34", "35-54", "55+"];
const GENDER_OPTIONS = ["Female", "Male", "Non-Binary", "Prefer not to say"];
const PLATFORM_OPTIONS = ["X (Twitter)", "Snapchat", "Instagram", "Facebook", "TikTok", "YouTube"];
const POSTING_OPTIONS = [
  "Rarely (less than once a month)",
  "Around once a month",
  "Weekly",
  "Daily or multiple times a day",
];
const MONITORING_PROMPT = "How do you monitor how your face, your likeness is used online?";
const MONITORING_OPTIONS = [
  "I don’t have a way to monitor my likeness",
  "I rely on friends and family to tell me what they've seen",
  "I subscribe to a likeness detection/monitoring service",
];
const MISUSE_PROMPT = "Have your photos or likeness ever been misused before (that you know of)?";

export const QUIZ_ANALYTICS_MAP: Readonly<Record<string, readonly MappedQuestion[]>> = {
  /* Production. */
  "likeness-health-v11": [
    { key: "age", id: "age", position: 1, prompt: "What's your age?", multi: false, options: AGE_OPTIONS, forwardAnswer: false },
    { key: "gender", id: "gender", position: 2, prompt: "What's your gender?", multi: false, options: GENDER_OPTIONS, forwardAnswer: false },
    { key: "platforms", id: "platforms", position: 3, prompt: "Which platforms do you use?", multi: true, options: PLATFORM_OPTIONS, forwardAnswer: true },
    {
      key: "posting_volume",
      id: "posting_volume",
      position: 4,
      prompt: "How often are photos of you shared online, either by you or by others?",
      multi: false,
      options: POSTING_OPTIONS,
      forwardAnswer: true,
    },
    {
      key: "prior_misuse",
      id: "prior_misuse",
      position: 5,
      prompt: MISUSE_PROMPT,
      multi: false,
      options: ["No known incidents", "Once or twice", "Happens regularly"],
      forwardAnswer: false,
    },
    { key: "discovery_method", id: "monitoring_method", position: 6, prompt: MONITORING_PROMPT, multi: false, options: MONITORING_OPTIONS, forwardAnswer: true },
  ],
  /* Development, and the local fixture (tools/dev-api/quiz.json). */
  "likeness-health-v17": [
    { key: "age", id: "age", position: 1, prompt: "What's your age?", multi: false, options: AGE_OPTIONS, forwardAnswer: false },
    { key: "gender", id: "gender", position: 2, prompt: "What's your gender?", multi: false, options: GENDER_OPTIONS, forwardAnswer: false },
    { key: "platforms", id: "platforms", position: 3, prompt: "Which platforms do you use?", multi: true, options: PLATFORM_OPTIONS, forwardAnswer: true },
    {
      key: "prior_misuse",
      id: "prior_misuse",
      position: 4,
      prompt: MISUSE_PROMPT,
      multi: false,
      options: ["No known incidents", "Once or twice", "Repeated pattern"],
      forwardAnswer: false,
    },
    {
      key: "posting_volume",
      id: "posting_volume",
      position: 5,
      prompt: "How often do you post new images of yourself?",
      multi: false,
      options: POSTING_OPTIONS,
      forwardAnswer: true,
    },
    { key: "q_il8uju", id: "monitoring_method", position: 6, prompt: MONITORING_PROMPT, multi: false, options: MONITORING_OPTIONS, forwardAnswer: true },
  ],
};
