"use client";

/**
 * Browser-side score loading, replacing the server-side `score-record.ts`.
 *
 * Calls the backend API directly with tokens from `browser-session`.
 */

import { callAsUser, ApiFailure } from "./api-client";
import { hasSession, isAccessExpired } from "./browser-session";
import { handoffFor, type Handoff } from "./handoff";
import { recommendationsFrom } from "./recommendations";
import { riskFactorsFrom, type ScoreEnvelope, type ScoreRecord } from "./score";

type Me = {
  person: {
    first_name: string | null;
    last_name: string | null;
    [key: string]: unknown;
  };
  onboarding: { quiz_completed?: boolean; [key: string]: unknown };
  score: {
    live?: number;
    total_score?: number;
    band: string;
    computed_at: string;
  } | null;
  [key: string]: unknown;
};

function firstNameOf(me: Me): string {
  return me.person.first_name?.trim() || "there";
}

function storedScoreOf(me: Me): { live: number; band: string } | null {
  const stored = me.score;
  const live = stored?.live ?? stored?.total_score;
  if (!stored || typeof live !== "number" || !Number.isFinite(live)) return null;
  return { live, band: stored.band };
}

export type ScoreLoad =
  | { ok: true; record: ScoreRecord; handoff: Handoff }
  | {
      ok: false;
      reason:
        | "signed-out"
        | "stale"
        | "missing"
        | "outdated"
        | "pending"
        | "unavailable";
    };

export async function loadScore(): Promise<ScoreLoad> {
  if (!hasSession()) {
    return { ok: false, reason: "signed-out" };
  }
  if (isAccessExpired()) {
    return { ok: false, reason: "stale" };
  }

  try {
    const [me, envelope] = await Promise.all([
      callAsUser<Me>("GET", "/v1/me"),
      callAsUser<ScoreEnvelope>("GET", "/v1/me/score").catch((error: unknown) => {
        if (
          error instanceof ApiFailure &&
          (error.code === "NO_QUIZ_RESPONSE" || error.code === "QUIZ_OUTDATED")
        ) {
          return error.code;
        }
        throw error;
      }),
    ]);

    if (typeof envelope === "string") {
      return resolveFromAccount(me, envelope);
    }
    return resolve(firstNameOf(me), envelope);
  } catch (error) {
    if (error instanceof ApiFailure) {
      if (error.status === 401) return { ok: false, reason: "stale" };
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}

function resolve(firstName: string, envelope: ScoreEnvelope): ScoreLoad {
  if (envelope.score === null) return { ok: false, reason: "pending" };

  const { score } = envelope;
  const riskFactors = riskFactorsFrom(score.risk_factors);
  const recommendations = recommendationsFrom(envelope.general_recommendations);

  return {
    ok: true,
    record: {
      score,
      scopeNote: envelope.scope_note,
      firstName,
      riskFactors,
      recommendations,
    },
    handoff: handoffFor(),
  };
}

function resolveFromAccount(
  me: Me,
  code: "NO_QUIZ_RESPONSE" | "QUIZ_OUTDATED",
): ScoreLoad {
  const stored = storedScoreOf(me);
  if (stored === null) {
    return { ok: false, reason: code === "QUIZ_OUTDATED" ? "outdated" : "missing" };
  }

  return {
    ok: true,
    record: {
      score: stored,
      scopeNote: "",
      firstName: firstNameOf(me),
      riskFactors: [],
      recommendations: [],
    },
    handoff: handoffFor(),
  };
}
