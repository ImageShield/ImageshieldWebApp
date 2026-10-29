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

/**
 * Reads the live quiz definition from the API (authenticated).
 */
async function readLiveDefinition(): Promise<{ quiz_version: string; questions: readonly { key: string; prompt: string; options: readonly string[]; multi?: boolean; scored?: boolean; required?: boolean; requires?: { key: string; value?: string; values?: readonly string[] } }[] }> {
  return callAsUser<{ quiz_version: string; questions: readonly { key: string; prompt: string; options: readonly string[]; multi?: boolean; scored?: boolean; required?: boolean; requires?: { key: string; value?: string; values?: readonly string[] } }[] }>("GET", "/v1/quiz");
}

/**
 * Checks whether the account already has a score on record.
 */
async function hasScoreOnRecord(): Promise<boolean> {
  try {
    await callAsUser<ScoreEnvelope>("GET", "/v1/me/score");
    return true;
  } catch (error) {
    if (!(error instanceof ApiFailure)) throw error;
    if (error.code === "NO_QUIZ_RESPONSE" || error.code === "QUIZ_OUTDATED") {
      // Check if the account carries a stored score via /v1/me
      const me = await callAsUser<{ score: { live?: number; total_score?: number } | null }>("GET", "/v1/me");
      const stored = me.score;
      const live = stored?.live ?? stored?.total_score;
      return stored !== null && typeof live === "number" && Number.isFinite(live);
    }
    throw error;
  }
}

export async function submitAnswers(): Promise<SubmitOutcome> {
  if (!hasSession()) {
    return { ok: false, reason: "signed-out", error: "Your session expired. Start again." };
  }

  // Check if account already has a score — don't overwrite it.
  let hasScore: boolean;
  try {
    hasScore = await hasScoreOnRecord();
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) {
      return { ok: false, reason: "signed-out", error: "Your session expired. Start again." };
    }
    return {
      ok: false,
      reason: "failed",
      error: "We couldn't check your score just now. Please try again.",
    };
  }
  if (hasScore) return { ok: true };

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
    await callAsUser<ScoreEnvelope>("POST", "/v1/quiz/responses", {
      body: { quiz_version: live.quiz_version, answers: parsed.answers },
    });
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
