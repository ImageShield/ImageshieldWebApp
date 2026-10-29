"use client";

/**
 * Browser-side transport for the /v1 API.
 *
 * Replaces the server-side `v1/client.ts` + session proxy. The browser now
 * calls the backend directly with bearer tokens from `browser-session`.
 */

import {
  accessToken,
  adoptTokens,
  clearSession,
  isAccessExpired,
  refreshToken,
  type TokenPair,
} from "./browser-session";

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter: number | null,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

type Envelope = { error: string; message: string; retry_after?: unknown };

function asEnvelope(body: unknown): Envelope | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.error !== "string") return null;
  if (typeof candidate.message !== "string") return null;
  return candidate as Envelope;
}

function failureFrom(status: number, body: unknown): ApiFailure {
  const envelope = asEnvelope(body);
  if (envelope === null) {
    return new ApiFailure(
      status,
      "NON_ENVELOPE_RESPONSE",
      `HTTP ${status} with no error envelope`,
      null,
      body,
    );
  }
  return new ApiFailure(
    status,
    envelope.error,
    envelope.message,
    typeof envelope.retry_after === "number" ? envelope.retry_after : null,
    body,
  );
}

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_IMAGESHIELD_API_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_IMAGESHIELD_API_URL is not set");
  }
  return url.replace(/\/+$/, "");
}

function withQuery(
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  if (!query) return path;
  const parts = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) parts.set(key, String(value));
  }
  const encoded = parts.toString();
  return encoded === "" ? path : `${path}?${encoded}`;
}

export type CallOptions = {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Set to true to include the access token. */
  authenticated?: boolean;
};

const NO_CONTENT = 204;
const CONFLICT = 409;
const MAX_CONFLICT_RETRIES = 3;
const MAX_RETRY_WAIT_S = 5;

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/**
 * Sends a request directly to the backend API from the browser.
 * Does NOT handle auto-refresh - use `callAsUser` for that.
 */
export async function call<T>(
  method: string,
  path: string,
  options: CallOptions & { retryConflict?: boolean } = {},
): Promise<T> {
  const url = `${apiBaseUrl()}${withQuery(path, options.query)}`;

  for (let attempt = 0; ; attempt += 1) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options.authenticated) {
      const token = accessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      });
    } catch (cause) {
      const why =
        cause instanceof Error
          ? cause.message
          : "the request never reached the API";
      throw new ApiFailure(0, "TRANSPORT", why, null, null);
    }

    if (response.status === NO_CONTENT) return undefined as T;

    const body = parseBody(await response.text());
    if (response.ok) return body as T;

    const failure = failureFrom(response.status, body);

    const worthRetrying =
      options.retryConflict === true &&
      response.status === CONFLICT &&
      failure.retryAfter !== null &&
      attempt < MAX_CONFLICT_RETRIES;
    if (!worthRetrying) throw failure;

    await sleep(Math.min(failure.retryAfter!, MAX_RETRY_WAIT_S) * 1000);
  }
}

/**
 * At most one refresh in flight. Refresh tokens rotate (each is single-use), so
 * a second concurrent call with the same token gets a 401 and kills the session.
 * Every caller awaits the same promise instead of racing.
 */
let inflightRefresh: Promise<boolean> | null = null;

/**
 * Refreshes the session by spending the refresh token for a new pair.
 * Returns true on success, false if the session is dead.
 *
 * Concurrent callers share a single in-flight request - the refresh token is
 * single-use, so only one call may present it.
 */
export async function refreshSession(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = doRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function doRefresh(): Promise<boolean> {
  const token = refreshToken();
  if (!token) return false;

  try {
    const pair = await call<TokenPair>("POST", "/v1/auth/refresh", {
      body: { refresh_token: token },
    });
    adoptTokens(pair);
    return true;
  } catch (error) {
    if (
      error instanceof ApiFailure &&
      (error.status === 401 || error.status === 403)
    ) {
      clearSession();
      return false;
    }
    throw error;
  }
}

/**
 * Calls the API as the signed-in visitor. Auto-refreshes a stale access token.
 * A 401 after refresh means the session is dead.
 */
export async function callAsUser<T>(
  method: string,
  path: string,
  options: Omit<CallOptions, "authenticated"> = {},
): Promise<T> {
  if (isAccessExpired()) {
    const ok = await refreshSession();
    if (!ok) throw new ApiFailure(401, "SESSION_EXPIRED", "session expired", null, null);
  }

  try {
    return await call<T>(method, path, { ...options, authenticated: true });
  } catch (error) {
    if (!(error instanceof ApiFailure) || error.status !== 401) throw error;
    // One retry after a refresh.
    const ok = await refreshSession();
    if (!ok) throw new ApiFailure(401, "SESSION_EXPIRED", "session expired", null, null);
    return call<T>(method, path, { ...options, authenticated: true });
  }
}

/**
 * Codes whose message describes machinery rather than anything a person can act
 * on. The caller's fallback is shown instead.
 */
const OPAQUE = new Set(["TRANSPORT", "NON_ENVELOPE_RESPONSE"]);

export function presentableFailure(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiFailure) || OPAQUE.has(cause.code)) return fallback;
  const message = cause.message.trim();
  if (message === "") return fallback;
  const sentence = message.charAt(0).toUpperCase() + message.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
