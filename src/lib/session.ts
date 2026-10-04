import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Contact } from "./contact";
import { funnelSecret } from "./env";
import { call, type CallOptions } from "./v1/client";
import { ApiFailure } from "./v1/errors";

/**
 * The funnel's server-side memory, in two cookies that hold different kinds of thing.
 *
 * On the legacy backend this was one signed cookie carrying a phone number and a
 * `verified` flag, because the score write named the user it was writing to and the
 * only thing standing between a visitor and a stranger's record was this server
 * refusing to take the phone number from the request body. /v1 removes that whole
 * class of problem: no route accepts an account id, person id or phone to decide
 * WHOSE data it touches — the bearer token is the answer. There is no longer any
 * such thing as "verified for +1555…"; there is a session or there isn't.
 *
 * So:
 *
 *   imageshield.funnel   The details a visitor typed and the id of the OTP challenge
 *                        they were issued, before any session exists. SIGNED, because
 *                        this server acts on them — an unsigned cookie would let a
 *                        visitor pair their own code entry with a challenge that
 *                        isn't theirs. Dies the moment a session replaces it.
 *
 *   imageshield.session  The /v1 access and refresh tokens. NOT signed, and it needs
 *                        no signature: the tokens authenticate themselves, so a
 *                        forged cookie is a 401 and nothing else. Signing it would
 *                        add a second, weaker gate in front of a strong one.
 *
 * Both are httpOnly. The access token in particular must never be readable from
 * script — it is a bearer credential for the user's real ImageShield account, not a
 * funnel artefact.
 */
const FUNNEL_COOKIE = "imageshield.funnel";
const SESSION_COOKIE = "imageshield.session";

/** Long enough to read the SMS and retype it, short enough that a shared phone
 *  doesn't hand the next person someone else's half-finished funnel run. */
const CHALLENGE_TTL_S = 15 * 60;

/**
 * How long this browser holds the session.
 *
 * Deliberately shorter than the API's own idea of the session's life. The refresh
 * token stays valid server-side after this expires; the browser simply forgets it,
 * and a visitor coming back days later verifies again. That is the same 24 hours the
 * funnel gave a verified phone number before, and the reason is the same one: this
 * screen gets opened on shared laptops, and what is being left behind now is a real
 * account session rather than a claim about a phone number.
 */
const SESSION_TTL_S = 24 * 60 * 60;

/**
 * Refresh this many seconds before the access token actually expires.
 *
 * Not paranoia about clock skew so much as about flight time: a token with two
 * seconds left is valid when we check it and expired by the time the API reads it.
 */
const EXPIRY_SKEW_S = 30;

export type Challenge = Contact & {
  /** From `POST /v1/auth/otp`. Verification is against this, not against the phone. */
  challengeId: string;
  /** Epoch seconds. Checked on read — the cookie's own maxAge is only a hint the
   *  browser is free to ignore. */
  exp: number;
};

export type Session = {
  access: string;
  refresh: string;
  /** Epoch seconds, already backed off by `EXPIRY_SKEW_S`. */
  accessExp: number;
};

/** What `POST /v1/auth/otp/verify` and `POST /v1/auth/refresh` both answer with. */
export type TokenPair = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

/**
 * Why a call couldn't be made as the visitor.
 *
 *   signed-out  There is no usable session and nothing this side can do about it.
 *               The refresh token was spent, revoked, or never there.
 *   stale       There IS a session, but the access token needs rotating and this
 *               context cannot write the new pair to a cookie. See `readAsUser`.
 */
export class SessionUnavailable extends Error {
  constructor(readonly reason: "signed-out" | "stale") {
    super(`session ${reason}`);
    this.name = "SessionUnavailable";
  }
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function sign(payload: string): string {
  return createHmac("sha256", funnelSecret())
    .update(payload)
    .digest("base64url");
}

function encode(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(raw: string): T | null {
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;

  const given = Buffer.from(mac);
  const expected = Buffer.from(sign(payload));
  // timingSafeEqual throws rather than returns false on a length mismatch.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    // Signed by us but shaped by an older release.
    return null;
  }
}

/** Local dev is plain http, so `secure` can't be unconditional. */
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/* ── The pre-verification challenge ──────────────────────────────────────────── */

/** Called when the OTP goes out: remembers the details and which challenge to verify. */
export async function startChallenge(
  contact: Contact,
  challengeId: string,
): Promise<void> {
  /* Field by field rather than spreading `contact`. The resend route hands back
     whatever `readChallenge` decoded, and a spread would re-sign any key that rode in
     on it into a fresh cookie with a fresh fifteen minutes — including the `dob` that
     cookies from before the 18+ checkbox carry. */
  const challenge: Challenge = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    ageConfirmed: contact.ageConfirmed,
    challengeId,
    exp: now() + CHALLENGE_TTL_S,
  };
  const store = await cookies();
  store.set(FUNNEL_COOKIE, encode(challenge), {
    ...COOKIE_BASE,
    maxAge: CHALLENGE_TTL_S,
  });
}

/**
 * The pending challenge, or null when there is none worth acting on.
 *
 * Only called from route handlers, which is what lets it delete as well as read.
 */
export async function readChallenge(): Promise<Challenge | null> {
  const store = await cookies();
  const raw = store.get(FUNNEL_COOKIE)?.value;
  if (!raw) return null;
  const challenge = decode<Challenge>(raw);
  if (!challenge || challenge.exp <= now()) return null;

  /* A cookie signed before the 18+ checkbox existed is still valid for up to fifteen
     minutes after a deploy. It was never confirmed, and it carries the birth date that
     visitor typed. So it counts as no challenge at all — verify and resend both
     answer "start again", which leads back to the details form, the one place the
     confirmation is asked for — and it is deleted on the spot rather than left to
     expire, so the typed date is never read, re-sent or re-signed. */
  if (challenge.ageConfirmed !== true) {
    store.delete(FUNNEL_COOKIE);
    return null;
  }
  return challenge;
}

/**
 * Dropped as soon as a session exists.
 *
 * The name and email are on the person record by then, and `GET /v1/me` is the one
 * place anything should read them from — keeping a second copy in a cookie is how
 * the result screen ends up greeting someone by a name they have since changed.
 */
export async function clearChallenge(): Promise<void> {
  (await cookies()).delete(FUNNEL_COOKIE);
}

/* ── The session ─────────────────────────────────────────────────────────────── */

export async function adoptTokens(pair: TokenPair): Promise<Session> {
  const session: Session = {
    access: pair.access_token,
    refresh: pair.refresh_token,
    accessExp: now() + pair.expires_in - EXPIRY_SKEW_S,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    ...COOKIE_BASE,
    maxAge: SESSION_TTL_S,
  });
  return session;
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    return typeof parsed?.access === "string" &&
      typeof parsed.refresh === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Module-internal: the only thing that ends a session is a refresh the API
 *  rejected. There is no sign-out in the funnel. */
async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(FUNNEL_COOKIE);
}

/**
 * Spends the refresh token for a new pair and banks the result.
 *
 * Refresh tokens ROTATE: the response carries a new one and the one just sent is
 * dead. That is the single most important fact about this function — every path out
 * of it either persists the new pair or ends the session, because a cookie left
 * holding a spent token is a session that looks alive and 401s on its next call.
 *
 * A refresh that never reached the API is NOT grounds for signing anyone out: it
 * says nothing about whether the session is valid, so the transport failure is
 * rethrown as itself and the cookie is left exactly as it was.
 */
async function rotate(session: Session): Promise<Session> {
  let pair: TokenPair;
  try {
    pair = await call<TokenPair>("POST", "/v1/auth/refresh", {
      body: { refresh_token: session.refresh },
    });
  } catch (failure) {
    if (
      failure instanceof ApiFailure &&
      (failure.status === 401 || failure.status === 403)
    ) {
      await endSession();
      throw new SessionUnavailable("signed-out");
    }
    throw failure;
  }
  return adoptTokens(pair);
}

/**
 * Calls /v1 as the signed-in visitor. **Route handlers only.**
 *
 * Refreshes when the access token is spent and writes the rotated pair back, which
 * is why this cannot be used from a server component's render: HTTP has no way to
 * set a cookie once a response has begun streaming, so Next allows `cookies().set`
 * only from a route handler or a server function. A render that silently refreshed
 * would spend the refresh token and have nowhere to put its replacement.
 *
 * Retrying after a 401 is safe even for a write: a 401 is refused at the door, so
 * nothing happened the first time.
 */
export async function callAsUser<T>(
  method: string,
  path: string,
  options: Omit<CallOptions, "accessToken"> = {},
): Promise<T> {
  let session = await readSession();
  if (session === null) throw new SessionUnavailable("signed-out");

  if (session.accessExp <= now()) session = await rotate(session);

  try {
    return await call<T>(method, path, {
      ...options,
      accessToken: session.access,
    });
  } catch (failure) {
    if (!(failure instanceof ApiFailure) || failure.status !== 401) throw failure;
    const refreshed = await rotate(session);
    return call<T>(method, path, {
      ...options,
      accessToken: refreshed.access,
    });
  }
}

/**
 * The same call from inside a server component's render, which cannot write cookies.
 *
 * Never refreshes. An expired or rejected access token surfaces as
 * `SessionUnavailable("stale")` so the page can render a small client component that
 * POSTs `/api/session/refresh` — a route handler, which CAN rotate and persist — and
 * then re-renders. One extra round trip, and only in the case where the visitor came
 * back after their access token ran out.
 *
 * Everything else the API says still throws as an `ApiFailure`, so a caller can tell
 * "no quiz taken yet" from "your session ended".
 */
export async function readAsUser<T>(
  method: string,
  path: string,
  options: Omit<CallOptions, "accessToken"> = {},
): Promise<T> {
  const session = await readSession();
  if (session === null) throw new SessionUnavailable("signed-out");
  if (session.accessExp <= now()) throw new SessionUnavailable("stale");

  try {
    return await call<T>(method, path, {
      ...options,
      accessToken: session.access,
    });
  } catch (failure) {
    /* Revocation bites immediately on this API — every request re-checks the session
       row — so a 401 on a token we believed was live is normal, not a contradiction. */
    if (failure instanceof ApiFailure && failure.status === 401) {
      throw new SessionUnavailable("stale");
    }
    throw failure;
  }
}

/** Rotates and persists, for `/api/session/refresh`. */
export async function refreshSession(): Promise<void> {
  const session = await readSession();
  if (session === null) throw new SessionUnavailable("signed-out");
  await rotate(session);
}
