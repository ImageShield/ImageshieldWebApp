"use client";

/**
 * Browser-side session: access and refresh tokens held in memory and backed to
 * sessionStorage so a reload mid-funnel does not cost the visitor a second OTP.
 *
 * Replaces the httpOnly cookie session that the proxy managed. Tokens are now
 * JS-accessible — an intentional trade-off of removing the server-side proxy.
 */

const STORAGE_KEY = "imageshield.session.v1";

/** Seconds to subtract from `expires_in` so a request in flight doesn't race
 *  the server's own clock. */
const EXPIRY_SKEW_S = 30;

export type TokenPair = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

type StoredSession = {
  access: string;
  refresh: string;
  /** Epoch seconds — already skewed by EXPIRY_SKEW_S. */
  accessExp: number;
};

let session: StoredSession | null = null;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function persist(s: StoredSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable — works for the current tab, gone on reload.
  }
}

function load(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed?.access !== "string" || typeof parsed.refresh !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Stores a fresh token pair from OTP verify or a refresh. */
export function adoptTokens(pair: TokenPair): void {
  session = {
    access: pair.access_token,
    refresh: pair.refresh_token,
    accessExp: now() + pair.expires_in - EXPIRY_SKEW_S,
  };
  persist(session);
}

/** The current access token, or null when there is no session. */
export function accessToken(): string | null {
  session ??= load();
  return session?.access ?? null;
}

/** The current refresh token, or null. */
export function refreshToken(): string | null {
  session ??= load();
  return session?.refresh ?? null;
}

/** Whether the access token is believed to have expired. */
export function isAccessExpired(): boolean {
  session ??= load();
  if (!session) return true;
  return session.accessExp <= now();
}

/** Whether any session exists at all. */
export function hasSession(): boolean {
  session ??= load();
  return session !== null;
}

/** Clears the session — used when a refresh is rejected. */
export function clearSession(): void {
  session = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
