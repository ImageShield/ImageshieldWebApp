"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizDefinition } from "./quiz";

/**
 * The quiz definition, fetched once per tab and shared by every screen that
 * needs it.
 *
 * Now calls the backend API directly instead of going through `/api/quiz-definition`.
 */

type State = {
  status: "loading" | "ready" | "failed";
  quiz: QuizDefinition | null;
  error: string | null;
};

const LOADING: State = { status: "loading", quiz: null, error: null };

let cached: QuizDefinition | null = null;
let inFlight: Promise<QuizDefinition> | null = null;

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_IMAGESHIELD_API_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_IMAGESHIELD_API_URL is not set");
  return url.replace(/\/+$/, "");
}

async function fetchDefinition(): Promise<QuizDefinition> {
  const response = await fetch(`${apiBaseUrl()}/v1/quiz`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      body.message ?? "We couldn't load the quiz just now. Please try again.",
    );
  }
  return (await response.json()) as QuizDefinition;
}

function load(): Promise<QuizDefinition> {
  if (cached !== null) return Promise.resolve(cached);
  inFlight ??= fetchDefinition().then(
    (definition) => {
      cached = definition;
      inFlight = null;
      return definition;
    },
    (error: unknown) => {
      inFlight = null;
      throw error;
    },
  );
  return inFlight;
}

export function useQuizDefinition(): State & { reload: () => void } {
  const [state, setState] = useState<State>(() =>
    cached === null ? LOADING : { status: "ready", quiz: cached, error: null },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cached !== null) return;

    let cancelled = false;
    load().then(
      (quiz) => {
        if (!cancelled) setState({ status: "ready", quiz, error: null });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({
          status: "failed",
          quiz: null,
          error:
            error instanceof Error
              ? error.message
              : "We couldn't load the quiz just now. Please try again.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    if (cached !== null) {
      setState({ status: "ready", quiz: cached, error: null });
      return;
    }
    inFlight = null;
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
