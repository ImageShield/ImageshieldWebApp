"use client";

import { readFunnel } from "./funnel-state";
import { callAsUser, ApiFailure } from "./api-client";
import { hasSession } from "./browser-session";
import { declaresMinor, validateAnswers } from "./quiz";
import type { ScoreEnvelope } from "./score";

/**
 * Posting the answers, shared by the two screens that do it.
 *
 * Now calls the backend directly instead of going through `/api/quiz`.
 * Answer validation and under-18 enforcement are done client-side before
 * the request, matching the checks the proxy route used to perform.
 */
export type SubmitOutcome =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "signed-out"
        | "retake"
        | "not-eligible"
        | "failed";
      error: string;
    };

/* ── Cached POST response ───────────────────────────────────────────────────
 *
 * `POST /v1/quiz/responses` returns the same `ScoreEnvelope` that
 * `GET /v1/me/score` does - including `score.risk_factors` and
 * `general_recommendations`. The GET may not carry those fields for every
 * account, so the POST response is the authoritative first copy. It is
 * stashed here and consumed once by `browser-score.ts` when the score page
 * loads; after that a reload falls back to the GET as before.
 */
let cachedEnvelope: ScoreEnvelope | null = null;

/** Returns (and clears) the envelope from the last successful submit, if any. */
export function consumeCachedEnvelope(): ScoreEnvelope | null {
  const envelope = cachedEnvelope;
  cachedEnvelope = null;
  return envelope;
}

/**
 * Reads the live quiz definition from the API (authenticated).
 */
async function readLiveDefinition(): Promise<{ quiz_version: string; questions: readonly { key: string; prompt: string; options: readonly string[]; multi?: boolean; scored?: boolean; required?: boolean; requires?: { key: string; value?: string; values?: readonly string[] } }[] }> {
  return callAsUser<{ quiz_version: string; questions: readonly { key: string; prompt: string; options: readonly string[]; multi?: boolean; scored?: boolean; required?: boolean; requires?: { key: string; value?: string; values?: readonly string[] } }[] }>("GET", "/v1/quiz");
}

export async function submitAnswers(): Promise<SubmitOutcome> {
  if (!hasSession()) {
    return { ok: false, reason: "signed-out", error: "Your session expired. Start again." };
  }

  /* No "does this account already have a score" check here: it also blocked a
     visitor from re-scoring after going back to correct an answer, because the
     score it found was the one their own first submit had just created. Whether a
     write may replace the response on record is the backend's call. */

  // Re-read the live definition to validate answers against.
  let live: { quiz_version: string; questions: readonly { key: string; prompt: string; options: readonly string[]; multi?: boolean; scored?: boolean; required?: boolean; requires?: { key: string; value?: string; values?: readonly string[] } }[] };
  try {
    live = await readLiveDefinition();
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      return { ok: false, reason: "signed-out", error: "Your session expired. Start again." };
    }
    return {
      ok: false,
      reason: "failed",
      error: "We couldn't load the quiz just now. Please try again.",
    };
  }

  const parsed = validateAnswers(live, readFunnel().answers);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: "retake",
      error: "The quiz has been updated. Please answer it again.",
    };
  }

  // Under-18 enforcement
  if (declaresMinor(parsed.answers)) {
    return {
      ok: false,
      reason: "not-eligible",
      error: "The Likeness Health Score is only available to people aged 18 and over.",
    };
  }

  // Submit answers directly to the backend
  try {
    const envelope = await callAsUser<ScoreEnvelope>("POST", "/v1/quiz/responses", {
      body: { quiz_version: live.quiz_version, answers: parsed.answers },
    });
    cachedEnvelope = envelope;
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) {
        return { ok: false, reason: "signed-out", error: "Your session expired. Start again." };
      }
      const message = error.message.trim();
      const sentence = message
        ? (message.charAt(0).toUpperCase() + message.slice(1) + (/[.!?]$/.test(message) ? "" : "."))
        : "We couldn't save your answers. Please try again.";
      return { ok: false, reason: "failed", error: sentence };
    }
    return {
      ok: false,
      reason: "failed",
      error: "We couldn't save your answers. Please try again.",
    };
  }

  return { ok: true };
}
