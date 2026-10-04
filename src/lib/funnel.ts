/**
 * The funnel as data.
 *
 * Designers reorder these screens constantly. Keep the order in this one array and
 * derive next/prev from it — never hardcode "after the quiz comes the details form"
 * in a screen.
 */
const FUNNEL_STEPS = [
  "landing",
  "quiz",
  "quiz-questions",
  "details",
  "otp",
  "calculating",
  "score",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const STEP_PATHS: Record<FunnelStep, string> = {
  landing: "/",
  /* "Take the Quiz" lands on the intro: marketing copy explaining what the quiz is.
     No API behind it, which is why it stays in front of everything else. */
  quiz: "/quiz",
  /* The questions themselves, asked before anything is asked OF the visitor. They
     are read from `GET /v1/quiz` without a session, which that endpoint now allows,
     because that endpoint is answered only to a session and there is none yet — see
     the note in that file for what the local copy costs and how drift is caught. */
  "quiz-questions": "/quiz/questions",
  /* Full name, email, phone and an 18+ checkbox. Submitting it sends the code. Asked
     once the visitor has answered eight questions and has a score waiting on the
     other side of it, which is the entire reason the quiz moved in front. */
  details: "/details",
  otp: "/otp",
  /* Where the answers are actually submitted and the score computed. It is a real
     wait: the code has just bought a session, so there is finally something to
     write the answers with. */
  calculating: "/calculating",
  /* Score, QR and the store links: one screen, fed by /api/score. */
  score: "/score",
};

/**
 * Where the details and OTP screens send someone who answered the quiz's age
 * question with the under-18 band. Not a step: nothing comes after it, so it sits
 * outside the array and next/prev never land on it.
 */
export const NOT_ELIGIBLE_PATH = "/not-eligible";

/**
 * Steps that move on by themselves.
 *
 * They are legitimate forward destinations but never back ones: landing on the
 * loader again just runs its timer and pushes the user straight back where they
 * came from, so a "Back" button pointing at one does nothing but flash.
 */
const AUTO_ADVANCING: ReadonlySet<FunnelStep> = new Set(["calculating"]);

function nextStep(step: FunnelStep): FunnelStep | null {
  return FUNNEL_STEPS[FUNNEL_STEPS.indexOf(step) + 1] ?? null;
}

function prevStep(step: FunnelStep): FunnelStep | null {
  const i = FUNNEL_STEPS.indexOf(step);
  return i > 0 ? FUNNEL_STEPS[i - 1] : null;
}

export function nextPath(step: FunnelStep): string | null {
  const next = nextStep(step);
  return next ? STEP_PATHS[next] : null;
}

/** Where a "Back" control on `step` should go — the nearest step the user can act on. */
export function backPath(step: FunnelStep): string | null {
  let prev = prevStep(step);
  while (prev && AUTO_ADVANCING.has(prev)) prev = prevStep(prev);
  return prev ? STEP_PATHS[prev] : null;
}
