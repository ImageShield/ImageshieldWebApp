"use client";

import { useSyncExternalStore } from "react";
import type { FunnelStep } from "./funnel";

/**
 * Funnel progress, persisted to sessionStorage.
 *
 * Mobile browsers evict background tabs aggressively. Without this, a user who takes
 * a call halfway through the quiz comes back to a blank step 1 and leaves. Answers
 * are written the moment they're picked, not on submit.
 *
 * sessionStorage (not localStorage) on purpose: a shared phone shouldn't hand the
 * next person someone else's answers or phone number.
 *
 * Exposed as an external store so screens read it during render instead of syncing
 * it into state from an effect — which would flash the empty step on every mount.
 */
const KEY = "imageshield.funnel.v1";

export type FunnelState = {
  /** A list for the multi-select questions, a bare string for the rest — the same
   *  shape `validateAnswers` expects, so this object POSTs straight through. */
  answers: Record<string, string | string[]>;
  /**
   * The `quiz_version` the answers above were given against, as it came back from
   * `GET /v1/quiz` when the questions were fetched.
   *
   * Carried because the API pins responses to a definition: `POST /v1/quiz/responses`
   * takes a version and rejects answers whose keys or values aren't in it. Locally it
   * does a narrower job: it catches a tab that has been sitting open across a DEPLOY,
   * whose stored answers belong to the questions the last release rendered.
   * `syncQuizVersion` clears those at the start of the quiz rather than letting them
   * ride to the end of the funnel.
   */
  quizVersion?: string;
  phone?: string;
  /** Seconds the API says to wait before a resend is allowed.
   *  The OTP screen counts this down rather than a fixed local constant. */
  resendAfter?: number;
  /** The OTP challenge ID from `POST /v1/auth/otp`. Verification is against this,
   *  not against the phone number. Held client-side since the browser now calls the
   *  backend directly. */
  challengeId?: string;
  /** Contact details collected on the details form, carried through to the verify
   *  step so the lead can be saved after OTP verification. */
  contact?: {
    firstName: string;
    lastName: string;
    email: string;
    ageConfirmed: boolean;
  };
  lastStep?: FunnelStep;
};

const EMPTY: FunnelState = { answers: {} };

const listeners = new Set<() => void>();

/**
 * useSyncExternalStore compares snapshots by identity, so a fresh object per call
 * would loop forever. Parse once, then keep this in step with every write.
 */
let cache: FunnelState | null = null;

function load(): FunnelState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as FunnelState) } : EMPTY;
  } catch {
    // Private mode, quota, or a stale shape from an older release.
    return EMPTY;
  }
}

export function readFunnel(): FunnelState {
  cache ??= load();
  return cache;
}

export function writeFunnel(patch: Partial<FunnelState>): FunnelState {
  const next = { ...readFunnel(), ...patch };
  cache = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — the funnel still works, it just won't survive a reload.
  }
  for (const listener of listeners) listener();
  return next;
}

/**
 * Reconciles what this tab has stored with the quiz this release renders.
 *
 * A version change means the questions changed, so the stored answers are answers to
 * something else — keeping them would show a half-filled quiz whose ticks belong to
 * questions that are no longer being asked. They are dropped and the quiz starts
 * clean, which is the only honest option and is much better met here than after the
 * visitor has entered their phone number and spent a code.
 *
 * Returns whether anything was cleared, so a screen can decide whether to send the
 * visitor back to question one.
 */
export function syncQuizVersion(version: string): boolean {
  const current = readFunnel();
  if (current.quizVersion === version) return false;

  const hadAnswers = Object.keys(current.answers).length > 0;
  writeFunnel({ quizVersion: version, answers: {} });
  return hadAnswers;
}

export function saveAnswer(
  questionId: string,
  value: string | string[],
): FunnelState {
  const { answers } = readFunnel();
  return writeFunnel({ answers: { ...answers, [questionId]: value } });
}

/**
 * Adds or removes one option of a multi-select answer.
 *
 * Order follows the question's option list rather than the order they were tapped,
 * so re-picking the same set always produces the same array — otherwise a back-and-
 * forth would keep rewriting sessionStorage with a reshuffled list.
 */
export function toggleAnswer(
  questionId: string,
  option: string,
  options: readonly string[],
): FunnelState {
  const current = readFunnel().answers[questionId];
  const picked = new Set(Array.isArray(current) ? current : []);
  if (!picked.delete(option)) picked.add(option);
  return saveAnswer(
    questionId,
    options.filter((o) => picked.has(o)),
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server render has no storage, so it starts empty and re-renders after hydration. */
function serverSnapshot(): FunnelState {
  return EMPTY;
}

export function useFunnel(): FunnelState {
  return useSyncExternalStore(subscribe, readFunnel, serverSnapshot);
}
